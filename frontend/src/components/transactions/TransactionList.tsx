import { useState } from "react";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { ConfidenceBadge } from "@/components/transactions/ConfidenceBadge";
import { CategoryCorrection } from "@/components/transactions/CategoryCorrection";
import { BulkCategorize } from "@/components/transactions/BulkCategorize";
import type { Transaction, Category } from "@/types/models";

interface TransactionListProps {
  transactions: Transaction[];
  categories?: Category[];
  loading?: boolean;
}

export function TransactionList({
  transactions,
  categories = [],
  loading,
}: TransactionListProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [correctionTxId, setCorrectionTxId] = useState<string | null>(null);

  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  function toggleAll() {
    if (selectedIds.size === transactions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(transactions.map((t) => t.id)));
    }
  }

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function handleBulkComplete() {
    setSelectedIds(new Set());
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-12 animate-pulse rounded-lg bg-muted"
          />
        ))}
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-12">
        <p className="text-lg font-medium text-muted-foreground">
          No transactions yet
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Add a transaction to get started.
        </p>
      </div>
    );
  }

  const allSelected =
    transactions.length > 0 && selectedIds.size === transactions.length;

  return (
    <div className="space-y-3">
      {selectedIds.size > 0 && (
        <BulkCategorize
          selectedIds={Array.from(selectedIds)}
          onComplete={handleBulkComplete}
        />
      )}

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Select all transactions"
                  className="rounded border-input"
                />
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Date
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Description
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Category
              </th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx) => {
              const category = tx.category_id
                ? categoryMap.get(tx.category_id)
                : null;

              return (
                <tr
                  key={tx.id}
                  className="border-b last:border-0 hover:bg-muted/30"
                >
                  <td className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(tx.id)}
                      onChange={() => toggleOne(tx.id)}
                      aria-label={`Select ${tx.description}`}
                      className="rounded border-input"
                    />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {formatDate(tx.date)}
                  </td>
                  <td className="px-4 py-3">{tx.description}</td>
                  <td className="relative px-4 py-3">
                    <button
                      type="button"
                      className="flex items-center gap-2 text-left text-muted-foreground hover:text-foreground"
                      onClick={() =>
                        setCorrectionTxId(
                          correctionTxId === tx.id ? null : tx.id
                        )
                      }
                    >
                      <span>{category?.name ?? "-"}</span>
                      <ConfidenceBadge
                        confidence={tx.category_confidence}
                        source={tx.category_source}
                      />
                    </button>
                    {correctionTxId === tx.id && (
                      <CategoryCorrection
                        transaction={tx}
                        onClose={() => setCorrectionTxId(null)}
                      />
                    )}
                  </td>
                  <td
                    className={`whitespace-nowrap px-4 py-3 text-right font-medium ${
                      tx.amount < 0 ? "text-red-500" : "text-green-600"
                    }`}
                  >
                    {formatCurrency(Math.abs(tx.amount))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
