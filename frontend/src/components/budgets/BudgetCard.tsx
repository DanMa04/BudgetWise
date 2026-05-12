import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BudgetProgressBar } from "./BudgetProgressBar";
import { formatCurrency } from "@/lib/formatters";
import type { BudgetWithSpend } from "@/types/models";

interface BudgetCardProps {
  budget: BudgetWithSpend;
}

export function BudgetCard({ budget }: BudgetCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">{budget.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <BudgetProgressBar percentage={budget.percentage_used} />
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">
            Spent: {formatCurrency(budget.spent_amount)}
          </span>
          <span className="font-medium">
            of {formatCurrency(budget.amount)}
          </span>
        </div>
        <div className="text-sm">
          <span className="text-muted-foreground">Remaining: </span>
          <span
            className={
              budget.remaining_amount < 0
                ? "font-medium text-red-500"
                : "font-medium text-green-600"
            }
          >
            {formatCurrency(budget.remaining_amount)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
