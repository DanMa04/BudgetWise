import { useEffect, useMemo, useState } from "react";
import {
  ComposedChart,
  Customized,
  Area,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatCurrency } from "@/lib/formatters";
import type { SpendingByCategoryOverTime } from "@/types/models";

const BUDGET_COLOR = "oklch(0.57 0.06 255)";
const CUMULATIVE_OVER_COLOR = "oklch(0.60 0.22 25)";

interface CategoryOverTimeChartProps {
  data: SpendingByCategoryOverTime[];
  granularity: string;
  chartType: "area" | "bar" | "line";
  highlightedCategory?: string | null;
  visibleCategories?: string[];
  singleCategoryBudget?: number;
}

export interface CategoryMeta {
  name: string;
  color: string;
}

export function extractCategoryMeta(
  data: SpendingByCategoryOverTime[],
): CategoryMeta[] {
  const metaMap = new Map<string, string>();
  for (const period of data) {
    for (const cat of period.categories) {
      if (!metaMap.has(cat.category_name)) {
        metaMap.set(cat.category_name, cat.category_color);
      }
    }
  }
  return Array.from(metaMap.entries()).map(([name, color]) => ({ name, color }));
}

function formatLabel(period: string, granularity: string): string {
  if (granularity === "weekly" && /^\d{4}-W\d{2}$/.test(period)) {
    const [yearStr, weekStr] = period.split("-W");
    const jan4 = new Date(Number(yearStr), 0, 4);
    const weekStart = new Date(jan4.getTime() + (Number(weekStr) - 1) * 7 * 86400000);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
    return `${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  }
  if (granularity === "monthly" && /^\d{4}-\d{2}$/.test(period)) {
    const d = new Date(`${period}-15T12:00:00`);
    return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
  }
  const d = new Date(`${period}T12:00:00`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function CustomTooltip({
  active,
  payload,
  label,
  granularity,
  categoryMeta,
}: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number | null }>;
  label?: string;
  granularity: string;
  categoryMeta: CategoryMeta[];
}) {
  if (!active || !payload?.length || !label) return null;

  const sorted = [...payload]
    .filter((p) => (p.value ?? 0) > 0 && !String(p.dataKey).startsWith("__"))
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  const total = sorted.reduce((sum, p) => sum + (p.value ?? 0), 0);
  const colorMap = new Map(categoryMeta.map((c) => [c.name, c.color]));

  // Extract overlay values (deduplicated — multiple Line components share the same dataKey)
  const overlayMap = new Map<string, number>();
  for (const p of payload) {
    const key = String(p.dataKey);
    if (key.startsWith("__") && !overlayMap.has(key) && p.value != null) {
      overlayMap.set(key, p.value);
    }
  }
  const budget = overlayMap.get("__budget");
  const cumulative = overlayMap.get("__cumulative");
  const isOverBudget = budget != null && cumulative != null && cumulative > budget;

  return (
    <div className="max-h-72 overflow-y-auto rounded-lg border bg-background px-3 py-2 shadow-md">
      <p className="mb-1.5 text-sm font-medium">
        {formatLabel(label, granularity)}
      </p>
      {sorted.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2 text-sm">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: colorMap.get(entry.dataKey) }}
          />
          <span className="flex-1 truncate text-muted-foreground">
            {entry.dataKey}
          </span>
          <span className="font-medium">{formatCurrency(entry.value ?? 0)}</span>
        </div>
      ))}
      <div className="mt-1.5 border-t pt-1.5 text-sm font-medium">
        Total: {formatCurrency(total)}
      </div>
      {(cumulative != null || budget != null) && (
        <div className="mt-1.5 space-y-0.5 border-t pt-1.5">
          {cumulative != null && (
            <div className="flex items-center gap-2 text-sm">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{
                  backgroundColor: isOverBudget
                    ? CUMULATIVE_OVER_COLOR
                    : BUDGET_COLOR,
                }}
              />
              <span className="flex-1 text-muted-foreground">Cumulative</span>
              <span
                className="font-medium"
                style={{ color: isOverBudget ? CUMULATIVE_OVER_COLOR : undefined }}
              >
                {formatCurrency(cumulative)}
              </span>
            </div>
          )}
          {budget != null && (
            <div className="flex items-center gap-2 text-sm">
              <span
                className="inline-block h-0.5 w-2.5 rounded-sm"
                style={{ backgroundColor: BUDGET_COLOR }}
              />
              <span className="flex-1 text-muted-foreground">Budget</span>
              <span className="font-medium">{formatCurrency(budget)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function CategoryOverTimeChart({
  data,
  granularity,
  chartType,
  highlightedCategory,
  visibleCategories,
  singleCategoryBudget,
}: CategoryOverTimeChartProps) {
  const [overlayHovered, setOverlayHovered] = useState(false);
  const [overlayLocked, setOverlayLocked] = useState(false);

  useEffect(() => {
    setOverlayLocked(false);
  }, [singleCategoryBudget]);

  const { chartData, categoryMeta } = useMemo(() => {
    const metaMap = new Map<string, string>();

    const rows = data.map((period) => {
      const row: Record<string, string | number> = { period: period.period };
      for (const cat of period.categories) {
        row[cat.category_name] = cat.amount;
        if (!metaMap.has(cat.category_name)) {
          metaMap.set(cat.category_name, cat.category_color);
        }
      }
      return row;
    });

    for (const row of rows) {
      for (const name of metaMap.keys()) {
        if (!(name in row)) row[name] = 0;
      }
    }

    const meta: CategoryMeta[] = Array.from(metaMap.entries()).map(
      ([name, color]) => ({ name, color })
    );

    return { chartData: rows, categoryMeta: meta };
  }, [data]);

  const renderMeta = useMemo(() => {
    if (visibleCategories && visibleCategories.length > 0) {
      return categoryMeta.filter((cat) =>
        visibleCategories.includes(cat.name),
      );
    }
    return categoryMeta;
  }, [categoryMeta, visibleCategories]);

  const budgetOverlayData = useMemo(() => {
    if (!singleCategoryBudget || renderMeta.length !== 1 || chartData.length === 0) return null;
    const catName = renderMeta[0].name;
    let running = 0;
    const withRunning = chartData.map((row) => {
      const spend = (row[catName] as number) ?? 0;
      running += spend;
      return { ...row, __cumulative: running };
    });
    const crossIdx = withRunning.findIndex((r) => r.__cumulative > singleCategoryBudget);

    // Compute the exact x-fraction (0–1 across the plot) where the line crosses
    // the budget value, used to position the gradient stop precisely.
    let crossFraction: number | null = null;
    if (crossIdx === 0) {
      crossFraction = 0;
    } else if (crossIdx > 0 && withRunning.length > 1) {
      const prev = withRunning[crossIdx - 1].__cumulative;
      const curr = withRunning[crossIdx].__cumulative;
      const t = (singleCategoryBudget - prev) / (curr - prev);
      crossFraction = (crossIdx - 1 + t) / (withRunning.length - 1);
    }

    const data = withRunning.map((row, i) => ({
      ...row,
      __budget: singleCategoryBudget,
      // Glow line only covers the above-budget portion (no bridge needed)
      __cumulativeAbove: crossIdx !== -1 && i >= crossIdx ? row.__cumulative : null,
    }));

    return { data, crossFraction };
  }, [singleCategoryBudget, renderMeta, chartData]);

  const overlayOpacity = overlayHovered || overlayLocked ? 1 : 0.4;
  const activeChartData = (budgetOverlayData?.data ?? chartData) as Record<string, unknown>[];

  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        No data for this period
      </div>
    );
  }

  function getOpacity(name: string): number {
    if (!highlightedCategory) return chartType === "area" ? 0.6 : 1;
    return name === highlightedCategory ? 1 : 0.15;
  }

  function getStrokeOpacity(name: string): number {
    if (!highlightedCategory) return 1;
    return name === highlightedCategory ? 1 : 0.15;
  }

  const commonProps = {
    data: activeChartData,
    margin: { top: 5, right: budgetOverlayData ? 80 : 20, left: 10, bottom: 5 },
  };

  const xAxisProps = {
    dataKey: "period" as const,
    tickFormatter: (val: string) => formatLabel(val, granularity),
    className: "text-xs",
    tick: { fontSize: 12 },
  };

  const yAxisProps = {
    tickFormatter: (val: number) => `$${val}`,
    className: "text-xs",
    tick: { fontSize: 12 },
    width: 60,
  };

  const tooltipContent = (
    <CustomTooltip granularity={granularity} categoryMeta={categoryMeta} />
  );

  const overlayLines = budgetOverlayData ? (
    <>
      {/* Inject gradient into the chart SVG — stop offset = exact crossing fraction */}
      <Customized
        component={() =>
          budgetOverlayData.crossFraction != null ? (
            <defs>
              <linearGradient
                id="kallio-cum-gradient"
                x1="0" y1="0" x2="1" y2="0"
                gradientUnits="objectBoundingBox"
              >
                <stop
                  offset={`${(budgetOverlayData.crossFraction * 100).toFixed(4)}%`}
                  stopColor={BUDGET_COLOR}
                />
                <stop
                  offset={`${(budgetOverlayData.crossFraction * 100).toFixed(4)}%`}
                  stopColor={CUMULATIVE_OVER_COLOR}
                />
              </linearGradient>
            </defs>
          ) : (
            <g />
          )
        }
      />

      {/* Budget dashed reference line */}
      <Line
        dataKey="__budget"
        stroke={BUDGET_COLOR}
        strokeWidth={1.5}
        strokeDasharray="6 3"
        strokeOpacity={overlayOpacity}
        dot={false}
        activeDot={false}
        isAnimationActive={false}
        legendType="none"
        label={(props: {x?: number; y?: number; index?: number; value?: number}) => {
          const { x = 0, y = 0, index, value } = props;
          if (index !== budgetOverlayData.data.length - 1 || value == null) return <g />;
          return (
            <text x={x + 6} y={y} dy={4} fill={BUDGET_COLOR} fontSize={10} fontWeight={500} opacity={overlayOpacity}>
              Budget
            </text>
          );
        }}
      />

      {/* Glow behind above-budget segment */}
      <Line
        dataKey="__cumulativeAbove"
        stroke={CUMULATIVE_OVER_COLOR}
        strokeWidth={8}
        strokeOpacity={overlayOpacity * 0.18}
        dot={false}
        activeDot={false}
        connectNulls={false}
        isAnimationActive={false}
        legendType="none"
      />

      {/* Cumulative spend — gradient transitions blue→red at exact crossing x */}
      <Line
        dataKey="__cumulative"
        stroke={
          budgetOverlayData.crossFraction != null
            ? "url(#kallio-cum-gradient)"
            : BUDGET_COLOR
        }
        strokeWidth={1.5}
        strokeOpacity={overlayOpacity}
        dot={false}
        activeDot={false}
        isAnimationActive={false}
        legendType="none"
        label={(props: {x?: number; y?: number; index?: number; value?: number | null}) => {
          const { x = 0, y = 0, index, value } = props;
          if (index !== budgetOverlayData.data.length - 1 || value == null) return <g />;
          const labelColor = budgetOverlayData.crossFraction != null ? CUMULATIVE_OVER_COLOR : BUDGET_COLOR;
          return (
            <text x={x + 6} y={y} dy={4} fill={labelColor} fontSize={10} fontWeight={500} opacity={overlayOpacity}>
              Cumulative
            </text>
          );
        }}
      />

      {/* Hit area — budget line */}
      <Line
        dataKey="__budget"
        stroke="transparent"
        strokeWidth={12}
        strokeOpacity={0.001}
        dot={false}
        activeDot={false}
        isAnimationActive={false}
        legendType="none"
        onMouseEnter={() => setOverlayHovered(true)}
        onMouseLeave={() => setOverlayHovered(false)}
        onClick={() => setOverlayLocked((l) => !l)}
      />
      {/* Hit area — cumulative */}
      <Line
        dataKey="__cumulative"
        stroke="transparent"
        strokeWidth={12}
        strokeOpacity={0.001}
        dot={false}
        activeDot={false}
        isAnimationActive={false}
        legendType="none"
        onMouseEnter={() => setOverlayHovered(true)}
        onMouseLeave={() => setOverlayHovered(false)}
        onClick={() => setOverlayLocked((l) => !l)}
      />
    </>
  ) : null;

  return (
    <div className="h-96" key={chartType}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis {...xAxisProps} />
          <YAxis {...yAxisProps} />
          <Tooltip content={tooltipContent} />

          {chartType === "area" &&
            renderMeta.map((cat) => (
              <Area
                key={cat.name}
                type="monotone"
                dataKey={cat.name}
                stackId="1"
                fill={cat.color}
                stroke={cat.color}
                fillOpacity={getOpacity(cat.name)}
                strokeOpacity={getStrokeOpacity(cat.name)}
                strokeWidth={1.5}
                isAnimationActive={true}
                animationDuration={600}
                animationEasing="ease-in-out"
              />
            ))}

          {chartType === "bar" &&
            renderMeta.map((cat) => (
              <Bar
                key={cat.name}
                dataKey={cat.name}
                stackId="1"
                fill={cat.color}
                fillOpacity={getOpacity(cat.name)}
                isAnimationActive={true}
                animationDuration={600}
                animationEasing="ease-in-out"
              />
            ))}

          {chartType === "line" &&
            renderMeta.map((cat) => (
              <Line
                key={cat.name}
                type="monotone"
                dataKey={cat.name}
                stroke={cat.color}
                strokeWidth={2}
                strokeOpacity={getStrokeOpacity(cat.name)}
                dot={{ r: 2 }}
                activeDot={{ r: 4 }}
                isAnimationActive={true}
                animationDuration={600}
                animationEasing="ease-in-out"
              />
            ))}

          {overlayLines}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
