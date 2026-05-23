import { useState } from "react";
import { RefreshCw, ChevronDown, ChevronUp, CheckSquare, Square, MinusSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { TransferRulesDialog } from "./TransferRulesDialog";
import { useTransactions } from "@/hooks/useTransactions";
import {
  useCorrectTransaction,
  useBulkCategorize,
  useRescanTransactions,
} from "@/hooks/useCategorization";
import { formatCurrency, formatDate } from "@/lib/formatters";
import type { Category, CategoryWithSpend } from "@/types/models";

interface CategoryDetailDialogProps {
  open: boolean;
  onClose: () => void;
  category: CategoryWithSpend;
  allCategories: Category[];
}

export function CategoryDetailDialog({
  open,
  onClose,
  category,
  allCategories,
}: CategoryDetailDialogProps) {
  const { data: txnData, isLoading } = useTransactions({
    category_id: category.id,
    per_page: 100,
    sort_by: "date",
    sort_dir: "desc",
  });
  const correctTransaction = useCorrectTransaction();
  const bulkCategorize = useBulkCategorize();
  const rescan = useRescanTransactions();
  const [showRules, setShowRules] = useState(false);
  const [expandedTxn, setExpandedTxn] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchTargetId, setBatchTargetId] = useState("");

  const transactions = txnData?.items ?? [];
  const otherCategories = allCategories.filter(
    (c) => c.id !== category.id
  );

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === transactions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(transactions.map((t) => t.id)));
    }
  }

  function handleRecategorize(txnId: string, newCategoryId: string) {
    correctTransaction.mutate(
      { transactionId: txnId, categoryId: newCategoryId, createRuleFlag: false },
      { onSuccess: () => setExpandedTxn(null) }
    );
  }

  function handleBulkRecategorize() {
    if (selectedIds.size === 0 || !batchTargetId) return;
    bulkCategorize.mutate(
      {
        transactionIds: Array.from(selectedIds),
        categoryId: batchTargetId,
      },
      {
        onSuccess: () => {
          setSelectedIds(new Set());
          setBatchTargetId("");
        },
      }
    );
  }

  function handleRescan() {
    rescan.mutate(category.id);
  }

  const allSelected = transactions.length > 0 && selectedIds.size === transactions.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < transactions.length;

  return (
    <>
      <Dialog open={open && !showRules}>
        <DialogContent
          onClose={onClose}
          className="max-h-[90vh] max-w-2xl overflow-y-auto"
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ backgroundColor: category.color || "#6b7280" }}
              />
              {category.name}
              <span className="text-sm font-normal text-muted-foreground">
                {category.transaction_count} transaction
                {category.transaction_count !== 1 && "s"} ·{" "}
                {formatCurrency(category.total_spend)}
              </span>
            </DialogTitle>
          </DialogHeader>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowRules(true)}
            >
              Transfer Rules
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRescan}
              disabled={rescan.isPending}
            >
              <RefreshCw
                className={`mr-1.5 h-3.5 w-3.5 ${rescan.isPending ? "animate-spin" : ""}`}
              />
              {rescan.isPending ? "Scanning..." : "Re-scan"}
            </Button>
            {rescan.isSuccess && rescan.data && (
              <span className="self-center text-xs text-muted-foreground">
                {rescan.data.updated} of {rescan.data.scanned} updated
              </span>
            )}
          </div>

          {/* Batch action bar */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-2">
              <span className="shrink-0 text-sm font-medium">
                {selectedIds.size} selected
              </span>
              <select
                className="flex h-8 flex-1 rounded-md border border-input bg-transparent px-2 text-sm"
                value={batchTargetId}
                onChange={(e) => setBatchTargetId(e.target.value)}
                disabled={bulkCategorize.isPending}
              >
                <option value="">Move to...</option>
                {otherCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <Button
                size="sm"
                onClick={handleBulkRecategorize}
                disabled={!batchTargetId || bulkCategorize.isPending}
              >
                {bulkCategorize.isPending ? "Moving..." : "Apply"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedIds(new Set());
                  setBatchTargetId("");
                }}
              >
                Clear
              </Button>
            </div>
          )}

          {isLoading ? (
            <div className="flex h-32 items-center justify-center">
              <Spinner className="h-6 w-6" />
            </div>
          ) : transactions.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No transactions in this category.
            </p>
          ) : (
            <div className="space-y-1">
              {/* Select all header */}
              <button
                type="button"
                className="flex w-full items-center gap-2 px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
                onClick={toggleSelectAll}
              >
                {allSelected ? (
                  <CheckSquare className="h-3.5 w-3.5" />
                ) : someSelected ? (
                  <MinusSquare className="h-3.5 w-3.5" />
                ) : (
                  <Square className="h-3.5 w-3.5" />
                )}
                {allSelected ? "Deselect all" : "Select all"}
              </button>

              {transactions.map((txn) => (
                <div key={txn.id} className="rounded-lg border">
                  <div className="flex items-center">
                    <button
                      type="button"
                      className="shrink-0 p-2.5 text-muted-foreground hover:text-foreground"
                      onClick={() => toggleSelect(txn.id)}
                    >
                      {selectedIds.has(txn.id) ? (
                        <CheckSquare className="h-4 w-4 text-primary" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      type="button"
                      className="flex flex-1 items-center gap-3 py-2.5 pr-2.5 text-left hover:bg-muted/50"
                      onClick={() =>
                        setExpandedTxn(expandedTxn === txn.id ? null : txn.id)
                      }
                    >
                      <span className="shrink-0 text-xs text-muted-foreground w-20">
                        {formatDate(txn.date)}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {txn.description}
                      </span>
                      <span
                        className={`shrink-0 text-sm font-medium tabular-nums ${
                          txn.amount < 0 ? "text-red-600" : "text-green-600"
                        }`}
                      >
                        {formatCurrency(Math.abs(txn.amount))}
                      </span>
                      {expandedTxn === txn.id ? (
                        <ChevronUp className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      )}
                    </button>
                  </div>

                  {expandedTxn === txn.id && (
                    <div className="border-t px-2.5 py-2 bg-muted/30">
                      <label className="text-xs text-muted-foreground">
                        Re-categorize to:
                      </label>
                      <select
                        className="mt-1 flex h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                        defaultValue=""
                        onChange={(e) => {
                          if (e.target.value) {
                            handleRecategorize(txn.id, e.target.value);
                          }
                        }}
                        disabled={correctTransaction.isPending}
                      >
                        <option value="">Select category...</option>
                        {otherCategories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {showRules && (
        <TransferRulesDialog
          open
          onClose={() => setShowRules(false)}
          sourceCategory={category}
          allCategories={allCategories}
        />
      )}
    </>
  );
}
