import { BudgetCard } from "./BudgetCard";
import type { BudgetWithSpend } from "@/types/models";

interface BudgetOverviewProps {
  budgets: BudgetWithSpend[];
  loading?: boolean;
}

export function BudgetOverview({ budgets, loading }: BudgetOverviewProps) {
  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-40 animate-pulse rounded-xl border bg-muted"
          />
        ))}
      </div>
    );
  }

  if (budgets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-12">
        <p className="text-lg font-medium text-muted-foreground">
          No budgets yet
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Create a budget to start tracking your spending.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {budgets.map((budget) => (
        <BudgetCard key={budget.id} budget={budget} />
      ))}
    </div>
  );
}
