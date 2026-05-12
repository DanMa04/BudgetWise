import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TransactionList } from "@/components/transactions/TransactionList";
import { useBudgetSummary } from "@/hooks/useBudgets";
import { useTransactions } from "@/hooks/useTransactions";
import { formatCurrency } from "@/lib/formatters";

export function DashboardPage() {
  const { displayName } = useAuth();
  const { data: summary } = useBudgetSummary();
  const { data: recentTxData, isLoading: txLoading } = useTransactions({
    page: 1,
    per_page: 5,
    sort_by: "date",
    sort_dir: "desc",
  });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">
        Welcome, {displayName}
      </h1>
      <p className="text-muted-foreground">
        Your financial overview at a glance.
      </p>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$0.00</div>
            <p className="text-xs text-muted-foreground">
              Connect accounts to see your balance
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              This Month's Spending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary
                ? formatCurrency(summary.total_spent)
                : "$0.00"}
            </div>
            <p className="text-xs text-muted-foreground">
              {summary
                ? "Based on your budget tracking"
                : "Add transactions to track spending"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Budget Remaining
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                summary && summary.total_remaining < 0
                  ? "text-red-500"
                  : ""
              }`}
            >
              {summary
                ? formatCurrency(summary.total_remaining)
                : "$0.00"}
            </div>
            <p className="text-xs text-muted-foreground">
              {summary
                ? `of ${formatCurrency(summary.total_budgeted)} budgeted`
                : "Set up budgets to get started"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Goals Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0%</div>
            <p className="text-xs text-muted-foreground">
              Create goals to track progress
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Recent Transactions</h2>
        <TransactionList
          transactions={recentTxData?.items ?? []}
          loading={txLoading}
        />
      </div>
    </div>
  );
}
