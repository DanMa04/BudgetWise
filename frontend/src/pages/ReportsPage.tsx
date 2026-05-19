import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SpendingPieChart } from "@/components/charts/SpendingPieChart";
import { TrendLineChart } from "@/components/charts/TrendLineChart";
import { BudgetVsActualBar } from "@/components/charts/BudgetVsActualBar";
import { MonthlyComparisonChart } from "@/components/charts/MonthlyComparisonChart";
import { TopMerchantsChart } from "@/components/charts/TopMerchantsChart";
import { CategoryOverTimeChart } from "@/components/charts/CategoryOverTimeChart";
import {
  useSpendingByCategory,
  useSpendingByCategoryOverTime,
  useSpendingTrends,
  useBudgetVsActual,
  useMonthlyComparison,
  useTopMerchants,
} from "@/hooks/useReports";
import type { SpendingByCategory } from "@/types/models";

type Preset = "7d" | "30d" | "90d" | "6m" | "1y" | "custom";
type Tab = "spending" | "budgets" | "income" | "trends";
type ChartType = "area" | "bar" | "line";

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

function getDefaultGranularity(preset: Preset): string {
  switch (preset) {
    case "7d":
      return "daily";
    case "30d":
      return "daily";
    case "90d":
      return "weekly";
    case "6m":
    case "1y":
      return "monthly";
    default:
      return "monthly";
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

const CHART_TYPES: { label: string; value: ChartType }[] = [
  { label: "Area", value: "area" },
  { label: "Bar", value: "bar" },
  { label: "Line", value: "line" },
];

function GranularityToggle({
  granularity,
  onChange,
}: {
  granularity: string;
  onChange: (g: string) => void;
}) {
  return (
    <div className="flex rounded-lg border bg-muted/30 p-1">
      {["daily", "weekly", "monthly"].map((g) => (
        <button
          key={g}
          onClick={() => onChange(g)}
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
  );
}

function LoadingSpinner() {
  return (
    <div className="flex h-64 items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
    </div>
  );
}

export function ReportsPage() {
  const [preset, setPreset] = useState<Preset>("30d");
  const [activeTab, setActiveTab] = useState<Tab>("spending");
  const [granularity, setGranularity] = useState("daily");
  const [chartType, setChartType] = useState<ChartType>("area");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [highlightedCategory, setHighlightedCategory] = useState<string | null>(null);
  const [drillDownCategory, setDrillDownCategory] = useState<SpendingByCategory | null>(null);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);

  const { startDate, endDate } = useMemo(() => {
    if (preset === "custom" && customStart && customEnd) {
      return { startDate: customStart, endDate: customEnd };
    }
    return getDateRange(preset);
  }, [preset, customStart, customEnd]);

  const months = useMemo(() => getMonthsForPreset(preset), [preset]);

  const { data: spendingByCategory, isLoading: loadingCategory } =
    useSpendingByCategory(startDate, endDate);
  const { data: categoryOverTime, isLoading: loadingCategoryOverTime } =
    useSpendingByCategoryOverTime(
      startDate,
      endDate,
      granularity,
      selectedCategoryIds.length > 0 ? selectedCategoryIds : undefined,
    );
  const { data: spendingTrends, isLoading: loadingTrends } =
    useSpendingTrends(startDate, endDate, granularity);
  const { data: budgetVsActual, isLoading: loadingBudget } =
    useBudgetVsActual(startDate, endDate);
  const { data: monthlyComparison, isLoading: loadingMonthly } =
    useMonthlyComparison(months);
  const { data: topMerchants, isLoading: loadingMerchants } =
    useTopMerchants(startDate, endDate, 10);

  function handlePresetChange(value: Preset) {
    setPreset(value);
    setGranularity(getDefaultGranularity(value));
  }

  const effectiveChartType = selectedCategoryIds.length > 0 ? "line" : chartType;

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
              onClick={() => handlePresetChange(value)}
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
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Spending by Category</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingCategory ? (
                  <LoadingSpinner />
                ) : (
                  <SpendingPieChart
                    data={spendingByCategory ?? []}
                    onCategoryClick={setDrillDownCategory}
                    highlightedCategory={highlightedCategory}
                    onCategoryHover={setHighlightedCategory}
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top Merchants</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingMerchants ? (
                  <LoadingSpinner />
                ) : (
                  <TopMerchantsChart data={topMerchants ?? []} />
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="text-base">
                  Category Spending Over Time
                </CardTitle>
                <div className="flex gap-2">
                  {selectedCategoryIds.length === 0 && (
                    <div className="flex rounded-lg border bg-muted/30 p-1">
                      {CHART_TYPES.map(({ label, value }) => (
                        <button
                          key={value}
                          onClick={() => setChartType(value)}
                          className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                            chartType === value
                              ? "bg-background shadow-sm"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                  <GranularityToggle
                    granularity={granularity}
                    onChange={setGranularity}
                  />
                </div>
              </div>

              {selectedCategoryIds.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Comparing:</span>
                  {selectedCategoryIds.map((id) => {
                    const cat = spendingByCategory?.find(
                      (c) => c.category_id === id,
                    );
                    return (
                      <button
                        key={id}
                        onClick={() =>
                          setSelectedCategoryIds((prev) =>
                            prev.filter((cid) => cid !== id),
                          )
                        }
                        className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors hover:bg-muted"
                      >
                        <span
                          className="inline-block h-2 w-2 rounded-full"
                          style={{ backgroundColor: cat?.category_color }}
                        />
                        {cat?.category_name ?? "Unknown"}
                        <span className="text-muted-foreground">&times;</span>
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setSelectedCategoryIds([])}
                    className="text-xs text-muted-foreground underline hover:text-foreground"
                  >
                    Clear all
                  </button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {loadingCategoryOverTime ? (
                <LoadingSpinner />
              ) : (
                <CategoryOverTimeChart
                  data={categoryOverTime ?? []}
                  granularity={granularity}
                  chartType={effectiveChartType}
                  highlightedCategory={highlightedCategory}
                  onCategoryHover={setHighlightedCategory}
                  onCategoryClick={(name) => {
                    const cat = spendingByCategory?.find(
                      (c) => c.category_name === name,
                    );
                    if (cat?.category_id) {
                      setSelectedCategoryIds((prev) =>
                        prev.includes(cat.category_id)
                          ? prev.filter((id) => id !== cat.category_id)
                          : prev.length < 8
                            ? [...prev, cat.category_id]
                            : prev,
                      );
                    }
                  }}
                />
              )}
            </CardContent>
          </Card>

          {drillDownCategory && (
            <DrillDownCard
              category={drillDownCategory}
              startDate={startDate}
              endDate={endDate}
              onClose={() => setDrillDownCategory(null)}
            />
          )}
        </div>
      )}

      {activeTab === "budgets" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Budget vs. Actual Spending</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingBudget ? (
              <LoadingSpinner />
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
              <LoadingSpinner />
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
              <GranularityToggle
                granularity={granularity}
                onChange={setGranularity}
              />
            </div>
          </CardHeader>
          <CardContent>
            {loadingTrends ? (
              <LoadingSpinner />
            ) : (
              <TrendLineChart
                data={spendingTrends ?? []}
                granularity={granularity}
              />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function DrillDownCard({
  category,
  startDate,
  endDate,
  onClose,
}: {
  category: SpendingByCategory;
  startDate: string;
  endDate: string;
  onClose: () => void;
}) {
  const [granularity, setGranularity] = useState("weekly");
  const { data, isLoading } = useSpendingByCategoryOverTime(
    startDate,
    endDate,
    granularity,
    category.category_id ? [category.category_id] : undefined,
  );

  return (
    <Card className="border-2" style={{ borderColor: category.category_color }}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{ backgroundColor: category.category_color }}
            />
            <CardTitle className="text-base">
              {category.category_name} — Spending Over Time
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <GranularityToggle
              granularity={granularity}
              onChange={setGranularity}
            />
            <button
              onClick={onClose}
              className="rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              &times;
            </button>
          </div>
        </div>
        <div className="flex gap-6 text-sm text-muted-foreground">
          <span>
            Total:{" "}
            <span className="font-medium text-foreground">
              ${category.total_amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </span>
          </span>
          <span>
            Transactions:{" "}
            <span className="font-medium text-foreground">
              {category.transaction_count}
            </span>
          </span>
          <span>
            Share:{" "}
            <span className="font-medium text-foreground">
              {category.percentage.toFixed(1)}%
            </span>
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
          </div>
        ) : (
          <CategoryOverTimeChart
            data={data ?? []}
            granularity={granularity}
            chartType="line"
          />
        )}
      </CardContent>
    </Card>
  );
}
