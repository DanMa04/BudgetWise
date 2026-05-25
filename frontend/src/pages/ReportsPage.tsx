import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SpendingPieChart } from "@/components/charts/SpendingPieChart";
import { TrendLineChart } from "@/components/charts/TrendLineChart";
import { BudgetVsActualBar } from "@/components/charts/BudgetVsActualBar";
import { MonthlyComparisonChart } from "@/components/charts/MonthlyComparisonChart";
import { TopMerchantsChart } from "@/components/charts/TopMerchantsChart";
import {
  CategoryOverTimeChart,
  extractCategoryMeta,
} from "@/components/charts/CategoryOverTimeChart";
import { VendorPieChart, VENDOR_COLORS } from "@/components/charts/VendorPieChart";
import { VendorOverTimeChart } from "@/components/charts/VendorOverTimeChart";
import {
  useSpendingByCategory,
  useSpendingByCategoryOverTime,
  useSpendingTrends,
  useBudgetVsActual,
  useMonthlyComparison,
  useTopMerchants,
  useCategoryVendors,
  useVendorSpendingOverTime,
} from "@/hooks/useReports";
import {
  groupSpendingByParent,
  groupBudgetVsActualByParent,
} from "@/lib/categoryGrouping";
import { EditableGrid } from "@/components/layout/EditableGrid";
import { GridCard } from "@/components/layout/GridCard";
import { useGridLayout, type LayoutPreset } from "@/hooks/useGridLayout";
import type { ResponsiveLayouts } from "react-grid-layout";
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

const DATE_PRESETS: { label: string; value: Preset }[] = [
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

// --- Grid layouts per tab ---

const SPENDING_LAYOUTS: ResponsiveLayouts = {
  lg: [
    { i: "over-time", x: 0, y: 0, w: 12, h: 14, minW: 6, minH: 10 },
    { i: "pie", x: 0, y: 14, w: 8, h: 17, minW: 4, minH: 10 },
    { i: "merchants", x: 8, y: 14, w: 4, h: 17, minW: 3, minH: 10 },
  ],
  md: [
    { i: "over-time", x: 0, y: 0, w: 12, h: 14, minW: 6, minH: 10 },
    { i: "pie", x: 0, y: 14, w: 8, h: 17, minW: 4, minH: 10 },
    { i: "merchants", x: 8, y: 14, w: 4, h: 17, minW: 3, minH: 10 },
  ],
  sm: [
    { i: "over-time", x: 0, y: 0, w: 6, h: 14, minW: 3, minH: 10 },
    { i: "pie", x: 0, y: 14, w: 6, h: 17, minW: 3, minH: 10 },
    { i: "merchants", x: 0, y: 31, w: 6, h: 15, minW: 3, minH: 10 },
  ],
  xs: [
    { i: "over-time", x: 0, y: 0, w: 1, h: 14, minH: 10 },
    { i: "pie", x: 0, y: 14, w: 1, h: 17, minH: 10 },
    { i: "merchants", x: 0, y: 31, w: 1, h: 15, minH: 10 },
  ],
};

const SPENDING_PRESETS: LayoutPreset[] = [
  { name: "default", label: "Default", layouts: SPENDING_LAYOUTS },
  {
    name: "side-by-side",
    label: "Three Columns",
    layouts: {
      ...SPENDING_LAYOUTS,
      lg: [
        { i: "over-time", x: 0, y: 0, w: 5, h: 17, minW: 4, minH: 10 },
        { i: "pie", x: 5, y: 0, w: 4, h: 17, minW: 3, minH: 10 },
        { i: "merchants", x: 9, y: 0, w: 3, h: 17, minW: 3, minH: 10 },
      ],
    },
  },
  {
    name: "merchants-wide",
    label: "Wide Merchants",
    layouts: {
      ...SPENDING_LAYOUTS,
      lg: [
        { i: "over-time", x: 0, y: 0, w: 12, h: 14, minW: 6, minH: 10 },
        { i: "pie", x: 0, y: 14, w: 6, h: 17, minW: 4, minH: 10 },
        { i: "merchants", x: 6, y: 14, w: 6, h: 17, minW: 3, minH: 10 },
      ],
    },
  },
];

const BUDGETS_LAYOUTS: ResponsiveLayouts = {
  lg: [{ i: "budget-vs-actual", x: 0, y: 0, w: 12, h: 14, minW: 6, minH: 10 }],
  md: [{ i: "budget-vs-actual", x: 0, y: 0, w: 12, h: 14, minW: 6, minH: 10 }],
  sm: [{ i: "budget-vs-actual", x: 0, y: 0, w: 6, h: 14, minW: 3, minH: 10 }],
  xs: [{ i: "budget-vs-actual", x: 0, y: 0, w: 1, h: 14, minH: 10 }],
};

const INCOME_LAYOUTS: ResponsiveLayouts = {
  lg: [{ i: "income-vs-expense", x: 0, y: 0, w: 12, h: 14, minW: 6, minH: 10 }],
  md: [{ i: "income-vs-expense", x: 0, y: 0, w: 12, h: 14, minW: 6, minH: 10 }],
  sm: [{ i: "income-vs-expense", x: 0, y: 0, w: 6, h: 14, minW: 3, minH: 10 }],
  xs: [{ i: "income-vs-expense", x: 0, y: 0, w: 1, h: 14, minH: 10 }],
};

const TRENDS_LAYOUTS: ResponsiveLayouts = {
  lg: [{ i: "spending-trends", x: 0, y: 0, w: 12, h: 14, minW: 6, minH: 10 }],
  md: [{ i: "spending-trends", x: 0, y: 0, w: 12, h: 14, minW: 6, minH: 10 }],
  sm: [{ i: "spending-trends", x: 0, y: 0, w: 6, h: 14, minW: 3, minH: 10 }],
  xs: [{ i: "spending-trends", x: 0, y: 0, w: 1, h: 14, minH: 10 }],
};

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
  const [activeCats, setActiveCats] = useState<string[]>([]);
  const [activeVendors, setActiveVendors] = useState<string[]>([]);

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
    useSpendingByCategoryOverTime(startDate, endDate, granularity);
  const { data: spendingTrends, isLoading: loadingTrends } =
    useSpendingTrends(startDate, endDate, granularity);
  const { data: budgetVsActual, isLoading: loadingBudget } =
    useBudgetVsActual(startDate, endDate);
  const { data: monthlyComparison, isLoading: loadingMonthly } =
    useMonthlyComparison(months);
  const { data: topMerchants, isLoading: loadingMerchants } =
    useTopMerchants(startDate, endDate, 15);
  const { data: vendorData, isLoading: loadingVendors } = useCategoryVendors(
    drillDownCategory?.category_id ?? undefined,
    startDate,
    endDate,
  );
  const { data: vendorOverTime, isLoading: loadingVendorOverTime } =
    useVendorSpendingOverTime(
      drillDownCategory?.category_id ?? undefined,
      startDate,
      endDate,
      granularity,
      10,
    );

  const groupedSpending = useMemo(
    () => groupSpendingByParent(spendingByCategory ?? []),
    [spendingByCategory]
  );
  const groupedBudget = useMemo(
    () => groupBudgetVsActualByParent(budgetVsActual ?? []),
    [budgetVsActual]
  );

  const allCategoryMeta = useMemo(
    () => extractCategoryMeta(categoryOverTime ?? []),
    [categoryOverTime],
  );

  const vendorColorMap = useMemo(() => {
    const map = new Map<string, string>();
    (vendorData ?? []).forEach((v, i) => {
      map.set(v.description, VENDOR_COLORS[i % VENDOR_COLORS.length]);
    });
    return map;
  }, [vendorData]);

  const spendingGrid = useGridLayout("reports-spending-layout", SPENDING_LAYOUTS, SPENDING_PRESETS);
  const budgetsGrid = useGridLayout("reports-budgets-layout", BUDGETS_LAYOUTS, []);
  const incomeGrid = useGridLayout("reports-income-layout", INCOME_LAYOUTS, []);
  const trendsGrid = useGridLayout("reports-trends-layout", TRENDS_LAYOUTS, []);

  function handlePresetChange(value: Preset) {
    setPreset(value);
    setGranularity(getDefaultGranularity(value));
  }

  const isDrilling = !!drillDownCategory;

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
          {DATE_PRESETS.map(({ label, value }) => (
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
        <>
        <EditableGrid {...spendingGrid}>
          <GridCard key="over-time" editing={spendingGrid.editing}>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="text-base">
                  Category Spending Over Time
                </CardTitle>
                <div className="flex gap-2">
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
                  <GranularityToggle
                    granularity={granularity}
                    onChange={setGranularity}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingCategoryOverTime ? (
                <LoadingSpinner />
              ) : (
                <>
                  <CategoryOverTimeChart
                    data={categoryOverTime ?? []}
                    granularity={granularity}
                    chartType={chartType}
                    highlightedCategory={highlightedCategory}
                    visibleCategories={
                      activeCats.length > 0 ? activeCats : undefined
                    }
                  />
                  {allCategoryMeta.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {allCategoryMeta.map((cat) => {
                        const isActive =
                          activeCats.length === 0 ||
                          activeCats.includes(cat.name);
                        return (
                          <button
                            key={cat.name}
                            onClick={() => {
                              setActiveCats((prev) => {
                                if (prev.length === 0) return [cat.name];
                                if (prev.includes(cat.name)) {
                                  return prev.filter((n) => n !== cat.name);
                                }
                                return [...prev, cat.name];
                              });
                            }}
                            onMouseEnter={() =>
                              setHighlightedCategory(cat.name)
                            }
                            onMouseLeave={() => setHighlightedCategory(null)}
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all ${
                              isActive
                                ? "border-border bg-background text-foreground hover:bg-muted"
                                : "border-transparent bg-muted/40 text-muted-foreground hover:bg-muted/60"
                            }`}
                          >
                            <span
                              className="inline-block h-2 w-2 rounded-full transition-opacity"
                              style={{
                                backgroundColor: cat.color,
                                opacity: isActive ? 1 : 0.3,
                              }}
                            />
                            {cat.name}
                          </button>
                        );
                      })}
                      {activeCats.length > 0 && (
                        <button
                          onClick={() => setActiveCats([])}
                          className="ml-1 text-xs text-muted-foreground underline hover:text-foreground"
                        >
                          Show all
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </GridCard>

          <GridCard key="pie" editing={spendingGrid.editing}>
            <CardHeader>
              <div className="flex items-center gap-2">
                {isDrilling && (
                  <button
                    onClick={() => { setDrillDownCategory(null); setActiveVendors([]); }}
                    className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-label="Back to all categories"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="m15 18-6-6 6-6" />
                    </svg>
                  </button>
                )}
                {isDrilling && drillDownCategory && (
                  <span
                    className="inline-block h-3 w-3 rounded-full"
                    style={{ backgroundColor: drillDownCategory.category_color }}
                  />
                )}
                <CardTitle className="text-base">
                  {isDrilling && drillDownCategory
                    ? `${drillDownCategory.category_name} — By Vendor`
                    : "Spending by Category"}
                </CardTitle>
              </div>
              {isDrilling && drillDownCategory && (
                <div className="flex gap-6 text-sm text-muted-foreground">
                  <span>
                    Total:{" "}
                    <span className="font-medium text-foreground">
                      ${drillDownCategory.total_amount.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </span>
                  <span>
                    Transactions:{" "}
                    <span className="font-medium text-foreground">
                      {drillDownCategory.transaction_count}
                    </span>
                  </span>
                  <span>
                    Share:{" "}
                    <span className="font-medium text-foreground">
                      {drillDownCategory.percentage.toFixed(1)}%
                    </span>
                  </span>
                </div>
              )}
            </CardHeader>
            <CardContent>
              <div
                key={isDrilling ? drillDownCategory?.category_id : "overview"}
                className="animate-in fade-in zoom-in-95 duration-300"
              >
                {isDrilling ? (
                  loadingVendors ? (
                    <LoadingSpinner />
                  ) : (
                    <VendorPieChart
                      data={vendorData ?? []}
                      activeVendors={activeVendors}
                      onVendorToggle={(name) =>
                        setActiveVendors((prev) => {
                          if (prev.length === 0) return [name];
                          if (prev.includes(name))
                            return prev.filter((n) => n !== name);
                          return [...prev, name];
                        })
                      }
                      colorMap={vendorColorMap}
                    />
                  )
                ) : loadingCategory ? (
                  <LoadingSpinner />
                ) : (
                  <SpendingPieChart
                    data={groupedSpending}
                    onCategoryClick={(cat) => { setDrillDownCategory(cat); setActiveVendors([]); }}
                    highlightedCategory={highlightedCategory}
                    onCategoryHover={setHighlightedCategory}
                  />
                )}
              </div>
            </CardContent>
          </GridCard>

          <GridCard key="merchants" editing={spendingGrid.editing}>
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
          </GridCard>
        </EditableGrid>

        {isDrilling && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {drillDownCategory && (
                      <span
                        className="inline-block h-3 w-3 rounded-full"
                        style={{ backgroundColor: drillDownCategory.category_color }}
                      />
                    )}
                    <CardTitle className="text-base">
                      {drillDownCategory?.category_name} — Vendor Spending Over Time
                    </CardTitle>
                  </div>
                  <GranularityToggle granularity={granularity} onChange={setGranularity} />
                </div>
              </CardHeader>
              <CardContent>
                {loadingVendorOverTime ? (
                  <LoadingSpinner />
                ) : (
                  <>
                    <VendorOverTimeChart
                      data={vendorOverTime ?? []}
                      granularity={granularity}
                      colorMap={vendorColorMap}
                      activeVendors={
                        activeVendors.length > 0 ? activeVendors : undefined
                      }
                    />
                    {vendorData && vendorData.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {vendorData.map((vendor) => {
                          const isVendorActive =
                            activeVendors.length === 0 ||
                            activeVendors.includes(vendor.description);
                          const color =
                            vendorColorMap.get(vendor.description) ?? "#9ca3af";
                          return (
                            <button
                              key={vendor.description}
                              onClick={() =>
                                setActiveVendors((prev) => {
                                  if (prev.length === 0) return [vendor.description];
                                  if (prev.includes(vendor.description))
                                    return prev.filter((n) => n !== vendor.description);
                                  return [...prev, vendor.description];
                                })
                              }
                              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium capitalize transition-all ${
                                isVendorActive
                                  ? "border-border bg-background text-foreground hover:bg-muted"
                                  : "border-transparent bg-muted/40 text-muted-foreground hover:bg-muted/60"
                              }`}
                            >
                              <span
                                className="inline-block h-2 w-2 rounded-full transition-opacity"
                                style={{
                                  backgroundColor: color,
                                  opacity: isVendorActive ? 1 : 0.3,
                                }}
                              />
                              {vendor.description}
                            </button>
                          );
                        })}
                        {activeVendors.length > 0 && (
                          <button
                            onClick={() => setActiveVendors([])}
                            className="ml-1 text-xs text-muted-foreground underline hover:text-foreground"
                          >
                            Show all
                          </button>
                        )}
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        )}
        </>
      )}

      {activeTab === "budgets" && (
        <EditableGrid {...budgetsGrid}>
          <GridCard key="budget-vs-actual" editing={budgetsGrid.editing}>
            <CardHeader>
              <CardTitle className="text-base">Budget vs. Actual Spending</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingBudget ? (
                <LoadingSpinner />
              ) : (
                <BudgetVsActualBar data={groupedBudget} />
              )}
            </CardContent>
          </GridCard>
        </EditableGrid>
      )}

      {activeTab === "income" && (
        <EditableGrid {...incomeGrid}>
          <GridCard key="income-vs-expense" editing={incomeGrid.editing}>
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
          </GridCard>
        </EditableGrid>
      )}

      {activeTab === "trends" && (
        <EditableGrid {...trendsGrid}>
          <GridCard key="spending-trends" editing={trendsGrid.editing}>
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
          </GridCard>
        </EditableGrid>
      )}
    </div>
  );
}
