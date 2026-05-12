import { useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TransactionList } from "@/components/transactions/TransactionList";
import { BudgetCard } from "@/components/budgets/BudgetCard";
import { SpendingPieChart } from "@/components/charts/SpendingPieChart";
import { TrendLineChart } from "@/components/charts/TrendLineChart";
import { TopMerchantsChart } from "@/components/charts/TopMerchantsChart";
import { useBudgetSummary } from "@/hooks/useBudgets";
import { useTransactions } from "@/hooks/useTransactions";
import {
  useSpendingByCategory,
  useSpendingTrends,
  useTopMerchants,
} from "@/hooks/useReports";
import { formatCurrency } from "@/lib/formatters";

function getDateRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  return {
    startDate: start.toISOString().split("T")[0],
    endDate: end.toISOString().split("T")[0],
  };
}

export function DashboardPage() {
  const { displayName } = useAuth();
  const { startDate, endDate } = useMemo(getDateRange, []);

  const { data: summary } = useBudgetSummary();
  const { data: recentTxData, isLoading: txLoading } = useTransactions({
    page: 1,
    per_page: 5,
    sort_by: "date",
    sort_dir: "desc",
  });
  const { data: spendingByCategory } = useSpendingByCategory(startDate, endDate);
  const { data: spendingTrends } = useSpendingTrends(startDate, endDate, "daily");
  const { data: topMerchants } = useTopMerchants(startDate, endDate, 5);

  const budgetHealth = summary
    ? Math.round(
        ((summary.total_budgeted - summary.total_spent) /
          Math.max(summary.total_budgeted, 1)) *
          100
      )
    : 0;

  const topBudgets = summary?.budgets.slice(0, 5) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Welcome, {displayName}
        </h1>
        <p className="text-muted-foreground">
          Your financial overview at a glance.
        </p>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Budgeted
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary ? formatCurrency(summary.total_budgeted) : "$0.00"}
            </div>
            <p className="text-xs text-muted-foreground">This period</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Spent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary ? formatCurrency(summary.total_spent) : "$0.00"}
            </div>
            <p className="text-xs text-muted-foreground">
              {summary ? "Based on budget tracking" : "Add transactions to track"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Remaining
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                summary && summary.total_remaining < 0 ? "text-red-500" : "text-green-600"
              }`}
            >
              {summary ? formatCurrency(summary.total_remaining) : "$0.00"}
            </div>
            <p className="text-xs text-muted-foreground">
              {summary
                ? `of ${formatCurrency(summary.total_budgeted)} budgeted`
                : "Set up budgets to start"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Budget Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                budgetHealth < 20
                  ? "text-red-500"
                  : budgetHealth < 50
                    ? "text-yellow-500"
                    : "text-green-600"
              }`}
            >
              {summary ? `${budgetHealth}%` : "N/A"}
            </div>
            <p className="text-xs text-muted-foreground">
              {summary ? "Budget remaining" : "Create budgets to track"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Spending by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <SpendingPieChart data={spendingByCategory ?? []} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Spending Trend (30 days)</CardTitle>
          </CardHeader>
          <CardContent>
            <TrendLineChart data={spendingTrends ?? []} granularity="daily" />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Budget Overview</CardTitle>
          </CardHeader>
          <CardContent>
            {topBudgets.length > 0 ? (
              <div className="space-y-3">
                {topBudgets.map((budget) => (
                  <BudgetCard key={budget.id} budget={budget} />
                ))}
              </div>
            ) : (
              <div className="flex h-64 items-center justify-center text-muted-foreground">
                No budgets set up yet
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Merchants</CardTitle>
          </CardHeader>
          <CardContent>
            <TopMerchantsChart data={topMerchants ?? []} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <TransactionList
            transactions={recentTxData?.items ?? []}
            loading={txLoading}
          />
        </CardContent>
      </Card>
    </div>
  );
}
