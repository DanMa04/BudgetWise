import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BudgetOverview } from "@/components/budgets/BudgetOverview";
import { ZeroBudgetDialog } from "@/components/budgets/ZeroBudgetDialog";
import { useBudgets, useBudgetSummary } from "@/hooks/useBudgets";
import { formatCurrency } from "@/lib/formatters";

export function BudgetsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data: budgets = [], isLoading } = useBudgets();
  const { data: summary } = useBudgetSummary();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Budgets</h1>
          <p className="text-muted-foreground">
            Set and monitor your spending limits.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          {budgets.length > 0 ? (
            <>
              <Pencil className="h-4 w-4" />
              Edit Budget
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" />
              Add Budget
            </>
          )}
        </Button>
      </div>

      {summary && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Budgeted
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(summary.total_budgeted)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Spent
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(summary.total_spent)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Remaining
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className={`text-2xl font-bold ${
                  summary.total_remaining < 0
                    ? "text-red-500"
                    : "text-green-600"
                }`}
              >
                {formatCurrency(summary.total_remaining)}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <BudgetOverview budgets={budgets} loading={isLoading} />

      <ZeroBudgetDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
      />
    </div>
  );
}
