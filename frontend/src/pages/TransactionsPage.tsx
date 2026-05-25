import { useMemo, useState } from "react";
import { AlertTriangle, CheckCheck, Plus, TrendingDown, TrendingUp, Scale } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { TransactionList } from "@/components/transactions/TransactionList";
import { TransactionFilters } from "@/components/transactions/TransactionFilters";
import { TransactionForm } from "@/components/transactions/TransactionForm";
import { SubscriptionSuggestions } from "@/components/transactions/SubscriptionSuggestions";
import { useTransactions, useCreateTransaction } from "@/hooks/useTransactions";
import { useConfirmImportCategories } from "@/hooks/useCategorization";
import { useCategories } from "@/hooks/useCategories";
import { useAccounts } from "@/hooks/useAccounts";
import type { TransactionFilters as FiltersType } from "@/types/models";

export function TransactionsPage() {
  const [filters, setFilters] = useState<FiltersType>({
    page: 1,
    per_page: 50,
    sort_by: "date",
    sort_dir: "desc",
  });
  const [formOpen, setFormOpen] = useState(false);

  const { data, isLoading, error } = useTransactions(filters);
  const { data: categories = [] } = useCategories();
  const { data: accounts = [] } = useAccounts();
  const createTransaction = useCreateTransaction();
  const confirmImports = useConfirmImportCategories();

  const items = data?.items;
  const uncategorizedCount = useMemo(() => {
    if (!items) return 0;
    return items.filter((t) => !t.category_id).length;
  }, [items]);
  const importCount = useMemo(() => {
    if (!items) return 0;
    return items.filter((t) => t.category_source === "import").length;
  }, [items]);

  function showUncategorized() {
    setFilters((f) => ({ ...f, category_id: "__uncategorized__", page: 1 }));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
          <p className="text-muted-foreground">
            Track and manage your expenses and income.
          </p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4" />
          Add Transaction
        </Button>
      </div>

      <SubscriptionSuggestions />

      {importCount > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-purple-300 bg-purple-50 px-4 py-3 dark:border-purple-700 dark:bg-purple-950/30">
          <CheckCheck className="h-4 w-4 text-purple-600" />
          <span className="flex-1 text-sm text-purple-800 dark:text-purple-200">
            {importCount} transaction{importCount !== 1 && "s"} categorized from
            import — confirm to clear the Import badges.
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={confirmImports.isPending}
            onClick={() => confirmImports.mutate()}
          >
            {confirmImports.isPending ? "Confirming…" : "Confirm All"}
          </Button>
        </div>
      )}

      {uncategorizedCount > 0 && filters.category_id !== "__uncategorized__" && (
        <div className="flex items-center gap-3 rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 dark:border-yellow-700 dark:bg-yellow-950/30">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <span className="flex-1 text-sm text-yellow-800 dark:text-yellow-200">
            You have {uncategorizedCount} uncategorized transaction
            {uncategorizedCount !== 1 && "s"}
          </span>
          <Button variant="outline" size="sm" onClick={showUncategorized}>
            Review
          </Button>
        </div>
      )}

      <TransactionFilters
        filters={filters}
        onFilterChange={setFilters}
        categories={categories}
      />

      {data && data.total > 0 && data.income_sum !== undefined && (
        <div className="flex flex-wrap gap-3 rounded-xl border border-white/8 bg-card/65 px-5 py-3 backdrop-blur-xl text-sm">
          <div className="flex items-center gap-2">
            <TrendingDown className="h-3.5 w-3.5 text-red-400" />
            <span className="text-muted-foreground">Expenses</span>
            <span className="font-semibold text-red-400">
              {formatCurrency(Math.abs(data.expense_sum ?? 0))}
            </span>
          </div>
          <div className="h-4 w-px bg-border self-center" />
          <div className="flex items-center gap-2">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-muted-foreground">Income</span>
            <span className="font-semibold text-emerald-400">
              {formatCurrency(data.income_sum ?? 0)}
            </span>
          </div>
          <div className="h-4 w-px bg-border self-center" />
          <div className="flex items-center gap-2">
            <Scale className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Net</span>
            {(() => {
              const net = (data.income_sum ?? 0) + (data.expense_sum ?? 0);
              return (
                <span className={`font-semibold ${net >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {net < 0 ? "-" : ""}{formatCurrency(Math.abs(net))}
                </span>
              );
            })()}
          </div>
          <span className="ml-auto self-center text-xs text-muted-foreground">
            {data.total} transaction{data.total !== 1 ? "s" : ""}
          </span>
        </div>
      )}

      {error ? (
        <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load transactions. Please try again.
        </div>
      ) : (
        <TransactionList
          transactions={data?.items ?? []}
          categories={categories}
          loading={isLoading}
        />
      )}

      {data && data.total_pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {data.page} of {data.total_pages} ({data.total} total)
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={data.page <= 1}
              onClick={() =>
                setFilters((f) => ({ ...f, page: (f.page ?? 1) - 1 }))
              }
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={data.page >= data.total_pages}
              onClick={() =>
                setFilters((f) => ({ ...f, page: (f.page ?? 1) + 1 }))
              }
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <TransactionForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={(data) => {
          createTransaction.mutate(data, {
            onSuccess: () => setFormOpen(false),
          });
        }}
        accounts={accounts}
        categories={categories}
      />
    </div>
  );
}
