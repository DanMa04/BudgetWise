import { formatCurrency, formatDate } from "@/lib/formatters";
import type { Transaction } from "@/types/models";

interface TransactionListProps {
  transactions: Transaction[];
  loading?: boolean;
}

export function TransactionList({
  transactions,
  loading,
}: TransactionListProps) {
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

  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
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
          {transactions.map((tx) => (
            <tr key={tx.id} className="border-b last:border-0 hover:bg-muted/30">
              <td className="whitespace-nowrap px-4 py-3">
                {formatDate(tx.date)}
              </td>
              <td className="px-4 py-3">{tx.description}</td>
              <td className="px-4 py-3 text-muted-foreground">
                {tx.category_id ?? "-"}
              </td>
              <td
                className={`whitespace-nowrap px-4 py-3 text-right font-medium ${
                  tx.amount > 0 ? "text-red-500" : "text-green-600"
                }`}
              >
                {formatCurrency(Math.abs(tx.amount))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
