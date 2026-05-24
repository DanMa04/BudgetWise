import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TransactionList } from "@/components/transactions/TransactionList";
import { BudgetCard } from "@/components/budgets/BudgetCard";
import { SpendingPieChart } from "@/components/charts/SpendingPieChart";
import { TrendLineChart } from "@/components/charts/TrendLineChart";
import { TopMerchantsChart } from "@/components/charts/TopMerchantsChart";
import { useBudgetSummary } from "@/hooks/useBudgets";
import { useTransactions } from "@/hooks/useTransactions";
import { useAccounts } from "@/hooks/useAccounts";
import { useGoals } from "@/hooks/useGoals";
import { GoalProgressRing } from "@/components/goals/GoalProgressRing";
import {
  useSpendingByCategory,
  useSpendingTrends,
  useTopMerchants,
} from "@/hooks/useReports";
import { formatCurrency } from "@/lib/formatters";
import { groupSpendingByParent } from "@/lib/categoryGrouping";
import { AlertBanner } from "@/components/notifications/AlertBanner";
import { EditableGrid } from "@/components/layout/EditableGrid";
import { GridCard } from "@/components/layout/GridCard";
import { useGridLayout, type LayoutPreset } from "@/hooks/useGridLayout";
import type { ResponsiveLayouts } from "react-grid-layout";

function getDateRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  return {
    startDate: start.toISOString().split("T")[0],
    endDate: end.toISOString().split("T")[0],
  };
}

const DEFAULT_LAYOUTS: ResponsiveLayouts = {
  lg: [
    { i: "budgeted", x: 0, y: 0, w: 3, h: 5, minW: 2, minH: 4 },
    { i: "spent", x: 3, y: 0, w: 3, h: 5, minW: 2, minH: 4 },
    { i: "remaining", x: 6, y: 0, w: 3, h: 5, minW: 2, minH: 4 },
    { i: "health", x: 9, y: 0, w: 3, h: 5, minW: 2, minH: 4 },
    { i: "accounts", x: 0, y: 5, w: 12, h: 7, minW: 4, minH: 5 },
    { i: "pie", x: 0, y: 12, w: 6, h: 11, minW: 4, minH: 8 },
    { i: "trend", x: 6, y: 12, w: 6, h: 11, minW: 4, minH: 8 },
    { i: "budgets", x: 0, y: 23, w: 6, h: 11, minW: 4, minH: 6 },
    { i: "merchants", x: 6, y: 23, w: 6, h: 11, minW: 4, minH: 6 },
    { i: "goals", x: 0, y: 34, w: 12, h: 8, minW: 4, minH: 5 },
    { i: "transactions", x: 0, y: 42, w: 12, h: 10, minW: 6, minH: 6 },
  ],
  md: [
    { i: "budgeted", x: 0, y: 0, w: 3, h: 5, minW: 2, minH: 4 },
    { i: "spent", x: 3, y: 0, w: 3, h: 5, minW: 2, minH: 4 },
    { i: "remaining", x: 6, y: 0, w: 3, h: 5, minW: 2, minH: 4 },
    { i: "health", x: 9, y: 0, w: 3, h: 5, minW: 2, minH: 4 },
    { i: "accounts", x: 0, y: 5, w: 12, h: 7, minW: 4, minH: 5 },
    { i: "pie", x: 0, y: 12, w: 6, h: 11, minW: 4, minH: 8 },
    { i: "trend", x: 6, y: 12, w: 6, h: 11, minW: 4, minH: 8 },
    { i: "budgets", x: 0, y: 23, w: 6, h: 11, minW: 4, minH: 6 },
    { i: "merchants", x: 6, y: 23, w: 6, h: 11, minW: 4, minH: 6 },
    { i: "goals", x: 0, y: 34, w: 12, h: 8, minW: 4, minH: 5 },
    { i: "transactions", x: 0, y: 42, w: 12, h: 10, minW: 6, minH: 6 },
  ],
  sm: [
    { i: "budgeted", x: 0, y: 0, w: 3, h: 5, minW: 2, minH: 4 },
    { i: "spent", x: 3, y: 0, w: 3, h: 5, minW: 2, minH: 4 },
    { i: "remaining", x: 0, y: 5, w: 3, h: 5, minW: 2, minH: 4 },
    { i: "health", x: 3, y: 5, w: 3, h: 5, minW: 2, minH: 4 },
    { i: "accounts", x: 0, y: 10, w: 6, h: 7, minW: 3, minH: 5 },
    { i: "pie", x: 0, y: 17, w: 6, h: 11, minW: 3, minH: 8 },
    { i: "trend", x: 0, y: 28, w: 6, h: 11, minW: 3, minH: 8 },
    { i: "budgets", x: 0, y: 39, w: 6, h: 11, minW: 3, minH: 6 },
    { i: "merchants", x: 0, y: 50, w: 6, h: 11, minW: 3, minH: 6 },
    { i: "goals", x: 0, y: 61, w: 6, h: 8, minW: 3, minH: 5 },
    { i: "transactions", x: 0, y: 69, w: 6, h: 10, minW: 3, minH: 6 },
  ],
  xs: [
    { i: "budgeted", x: 0, y: 0, w: 1, h: 5, minH: 4 },
    { i: "spent", x: 0, y: 5, w: 1, h: 5, minH: 4 },
    { i: "remaining", x: 0, y: 10, w: 1, h: 5, minH: 4 },
    { i: "health", x: 0, y: 15, w: 1, h: 5, minH: 4 },
    { i: "accounts", x: 0, y: 20, w: 1, h: 7, minH: 5 },
    { i: "pie", x: 0, y: 27, w: 1, h: 11, minH: 8 },
    { i: "trend", x: 0, y: 38, w: 1, h: 11, minH: 8 },
    { i: "budgets", x: 0, y: 49, w: 1, h: 11, minH: 6 },
    { i: "merchants", x: 0, y: 60, w: 1, h: 11, minH: 6 },
    { i: "goals", x: 0, y: 71, w: 1, h: 8, minH: 5 },
    { i: "transactions", x: 0, y: 79, w: 1, h: 10, minH: 6 },
  ],
};

const PRESETS: LayoutPreset[] = [
  {
    name: "default",
    label: "Default",
    layouts: DEFAULT_LAYOUTS,
  },
  {
    name: "charts-first",
    label: "Charts First",
    layouts: {
      lg: [
        { i: "pie", x: 0, y: 0, w: 6, h: 11, minW: 4, minH: 8 },
        { i: "trend", x: 6, y: 0, w: 6, h: 11, minW: 4, minH: 8 },
        { i: "budgeted", x: 0, y: 11, w: 3, h: 5, minW: 2, minH: 4 },
        { i: "spent", x: 3, y: 11, w: 3, h: 5, minW: 2, minH: 4 },
        { i: "remaining", x: 6, y: 11, w: 3, h: 5, minW: 2, minH: 4 },
        { i: "health", x: 9, y: 11, w: 3, h: 5, minW: 2, minH: 4 },
        { i: "budgets", x: 0, y: 16, w: 6, h: 11, minW: 4, minH: 6 },
        { i: "merchants", x: 6, y: 16, w: 6, h: 11, minW: 4, minH: 6 },
        { i: "accounts", x: 0, y: 27, w: 6, h: 7, minW: 4, minH: 5 },
        { i: "goals", x: 6, y: 27, w: 6, h: 7, minW: 4, minH: 5 },
        { i: "transactions", x: 0, y: 34, w: 12, h: 10, minW: 6, minH: 6 },
      ],
      md: DEFAULT_LAYOUTS.md,
      sm: DEFAULT_LAYOUTS.sm,
      xs: DEFAULT_LAYOUTS.xs,
    },
  },
  {
    name: "compact",
    label: "Compact",
    layouts: {
      lg: [
        { i: "budgeted", x: 0, y: 0, w: 3, h: 5, minW: 2, minH: 4 },
        { i: "spent", x: 3, y: 0, w: 3, h: 5, minW: 2, minH: 4 },
        { i: "remaining", x: 6, y: 0, w: 3, h: 5, minW: 2, minH: 4 },
        { i: "health", x: 9, y: 0, w: 3, h: 5, minW: 2, minH: 4 },
        { i: "pie", x: 0, y: 5, w: 4, h: 11, minW: 4, minH: 8 },
        { i: "trend", x: 4, y: 5, w: 4, h: 11, minW: 4, minH: 8 },
        { i: "merchants", x: 8, y: 5, w: 4, h: 11, minW: 4, minH: 6 },
        { i: "accounts", x: 0, y: 16, w: 4, h: 7, minW: 4, minH: 5 },
        { i: "budgets", x: 4, y: 16, w: 4, h: 7, minW: 4, minH: 6 },
        { i: "goals", x: 8, y: 16, w: 4, h: 7, minW: 4, minH: 5 },
        { i: "transactions", x: 0, y: 23, w: 12, h: 10, minW: 6, minH: 6 },
      ],
      md: DEFAULT_LAYOUTS.md,
      sm: DEFAULT_LAYOUTS.sm,
      xs: DEFAULT_LAYOUTS.xs,
    },
  },
];

export function DashboardPage() {
  const { displayName } = useAuth();
  const { startDate, endDate } = useMemo(() => getDateRange(), []);

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
  const { data: accounts } = useAccounts();
  const { data: goals } = useGoals();

  const budgetHealth = summary
    ? Math.round(
        ((summary.total_budgeted - summary.total_spent) /
          Math.max(summary.total_budgeted, 1)) *
          100
      )
    : 0;

  const topBudgets = summary?.budgets.slice(0, 5) ?? [];

  const grid = useGridLayout("dashboard-layout", DEFAULT_LAYOUTS, PRESETS);

  return (
    <div className="space-y-6">
      <AlertBanner />
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Welcome, {displayName}
          </h1>
          <p className="text-muted-foreground">
            Your financial overview at a glance.
          </p>
        </div>
      </div>

      <EditableGrid {...grid}>
        <GridCard key="budgeted" editing={grid.editing}>
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
        </GridCard>

        <GridCard key="spent" editing={grid.editing}>
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
        </GridCard>

        <GridCard key="remaining" editing={grid.editing}>
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
        </GridCard>

        <GridCard key="health" editing={grid.editing}>
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
        </GridCard>

        <GridCard key="accounts" editing={grid.editing}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Account Balances</CardTitle>
            <Link
              to="/accounts"
              className="text-sm text-primary hover:underline"
            >
              View all
            </Link>
          </CardHeader>
          <CardContent>
            {accounts && accounts.length > 0 ? (
              <div className="space-y-3">
                {accounts.slice(0, 4).map((account) => (
                  <div
                    key={account.id}
                    className="flex items-center justify-between"
                  >
                    <div>
                      <p className="text-sm font-medium">{account.name}</p>
                      {account.institution_name && (
                        <p className="text-xs text-muted-foreground">
                          {account.institution_name}
                        </p>
                      )}
                    </div>
                    <span
                      className={`text-sm font-semibold ${
                        account.current_balance < 0
                          ? "text-red-500"
                          : "text-green-600"
                      }`}
                    >
                      {formatCurrency(account.current_balance)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No accounts yet</p>
            )}
          </CardContent>
        </GridCard>

        <GridCard key="pie" editing={grid.editing}>
          <CardHeader>
            <CardTitle className="text-base">Spending by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <SpendingPieChart data={groupSpendingByParent(spendingByCategory ?? [])} />
          </CardContent>
        </GridCard>

        <GridCard key="trend" editing={grid.editing}>
          <CardHeader>
            <CardTitle className="text-base">Spending Trend (30 days)</CardTitle>
          </CardHeader>
          <CardContent>
            <TrendLineChart data={spendingTrends ?? []} granularity="daily" />
          </CardContent>
        </GridCard>

        <GridCard key="budgets" editing={grid.editing}>
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
              <div className="flex h-32 items-center justify-center text-muted-foreground">
                No budgets set up yet
              </div>
            )}
          </CardContent>
        </GridCard>

        <GridCard key="merchants" editing={grid.editing}>
          <CardHeader>
            <CardTitle className="text-base">Top Merchants</CardTitle>
          </CardHeader>
          <CardContent>
            <TopMerchantsChart data={topMerchants ?? []} />
          </CardContent>
        </GridCard>

        <GridCard key="goals" editing={grid.editing}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Goals</CardTitle>
            <Link
              to="/goals"
              className="text-sm text-primary hover:underline"
            >
              View all
            </Link>
          </CardHeader>
          <CardContent>
            {goals && goals.length > 0 ? (
              <div className="space-y-3">
                {goals.slice(0, 3).map((goal) => (
                  <div key={goal.id} className="flex items-center gap-3">
                    <GoalProgressRing
                      percentage={
                        goal.target_amount > 0
                          ? (goal.current_amount / goal.target_amount) * 100
                          : 0
                      }
                      size={48}
                      strokeWidth={4}
                      color={goal.color || undefined}
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{goal.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(goal.current_amount)} of{" "}
                        {formatCurrency(goal.target_amount)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No goals yet</p>
            )}
          </CardContent>
        </GridCard>

        <GridCard key="transactions" editing={grid.editing}>
          <CardHeader>
            <CardTitle className="text-base">Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <TransactionList
              transactions={recentTxData?.items ?? []}
              loading={txLoading}
            />
          </CardContent>
        </GridCard>
      </EditableGrid>
    </div>
  );
}
