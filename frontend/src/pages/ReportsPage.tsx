import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SpendingPieChart } from "@/components/charts/SpendingPieChart";
import { TrendLineChart } from "@/components/charts/TrendLineChart";
import { BudgetVsActualBar } from "@/components/charts/BudgetVsActualBar";
import { MonthlyComparisonChart } from "@/components/charts/MonthlyComparisonChart";
import { TopMerchantsChart } from "@/components/charts/TopMerchantsChart";
import {
  useSpendingByCategory,
  useSpendingTrends,
  useBudgetVsActual,
  useMonthlyComparison,
  useTopMerchants,
} from "@/hooks/useReports";

type Preset = "7d" | "30d" | "90d" | "6m" | "1y" | "custom";
type Tab = "spending" | "budgets" | "income" | "trends";

function getDateRange(preset: Preset): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date();

  switch (preset) {
    case "7d":
      start.setDate(start.getDate() - 7);
      break;
    case "30d":
      start.setDate(start.getDate() - 30);
      break;
    case "90d":
      start.setDate(start.getDate() - 90);
      break;
    case "6m":
      start.setMonth(start.getMonth() - 6);
      break;
    case "1y":
      start.setFullYear(start.getFullYear() - 1);
      break;
    default:
      start.setDate(start.getDate() - 30);
  }

  return {
    startDate: start.toISOString().split("T")[0],
    endDate: end.toISOString().split("T")[0],
  };
}

function getMonthsForPreset(preset: Preset): number {
  switch (preset) {
    case "7d":
    case "30d":
      return 3;
    case "90d":
      return 3;
    case "6m":
      return 6;
    case "1y":
      return 12;
    default:
      return 6;
  }
}

const PRESETS: { label: string; value: Preset }[] = [
  { label: "7D", value: "7d" },
  { label: "30D", value: "30d" },
  { label: "90D", value: "90d" },
  { label: "6M", value: "6m" },
  { label: "1Y", value: "1y" },
  { label: "Custom", value: "custom" },
];

const TABS: { label: string; value: Tab }[] = [
  { label: "Spending", value: "spending" },
  { label: "Budgets", value: "budgets" },
  { label: "Income", value: "income" },
  { label: "Trends", value: "trends" },
];

export function ReportsPage() {
  const [preset, setPreset] = useState<Preset>("30d");
  const [activeTab, setActiveTab] = useState<Tab>("spending");
  const [granularity, setGranularity] = useState("daily");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const { startDate, endDate } = useMemo(() => {
    if (preset === "custom" && customStart && customEnd) {
      return { startDate: customStart, endDate: customEnd };
    }
    return getDateRange(preset);
  }, [preset, customStart, customEnd]);

  const months = useMemo(() => getMonthsForPreset(preset), [preset]);

  const { data: spendingByCategory, isLoading: loadingCategory } =
    useSpendingByCategory(startDate, endDate);
  const { data: spendingTrends, isLoading: loadingTrends } =
    useSpendingTrends(startDate, endDate, granularity);
  const { data: budgetVsActual, isLoading: loadingBudget } =
    useBudgetVsActual(startDate, endDate);
  const { data: monthlyComparison, isLoading: loadingMonthly } =
    useMonthlyComparison(months);
  const { data: topMerchants, isLoading: loadingMerchants } =
    useTopMerchants(startDate, endDate, 10);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
        <p className="text-muted-foreground">
          Analyze your spending patterns and financial trends.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border bg-muted/30 p-1">
          {PRESETS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setPreset(value)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                preset === value
                  ? "bg-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {preset === "custom" && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="rounded-md border bg-background px-3 py-1.5 text-sm"
              aria-label="Start date"
            />
            <span className="text-sm text-muted-foreground">to</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="rounded-md border bg-background px-3 py-1.5 text-sm"
              aria-label="End date"
            />
          </div>
        )}
      </div>

      <div className="flex border-b">
        {TABS.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => setActiveTab(value)}
            className={`border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === value
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === "spending" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Spending by Category</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingCategory ? (
                <div className="flex h-64 items-center justify-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
                </div>
              ) : (
                <SpendingPieChart data={spendingByCategory ?? []} />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top Merchants</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingMerchants ? (
                <div className="flex h-64 items-center justify-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
                </div>
              ) : (
                <TopMerchantsChart data={topMerchants ?? []} />
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "budgets" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Budget vs. Actual Spending</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingBudget ? (
              <div className="flex h-64 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
              </div>
            ) : (
              <BudgetVsActualBar data={budgetVsActual ?? []} />
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "income" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Income vs. Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingMonthly ? (
              <div className="flex h-64 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
              </div>
            ) : (
              <MonthlyComparisonChart data={monthlyComparison ?? []} />
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "trends" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Spending Trends</CardTitle>
              <div className="flex rounded-lg border bg-muted/30 p-1">
                {["daily", "weekly", "monthly"].map((g) => (
                  <button
                    key={g}
                    onClick={() => setGranularity(g)}
                    className={`rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors ${
                      granularity === g
                        ? "bg-background shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingTrends ? (
              <div className="flex h-64 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
              </div>
            ) : (
              <TrendLineChart data={spendingTrends ?? []} granularity={granularity} />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
