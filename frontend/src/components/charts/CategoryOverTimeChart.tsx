import { useMemo } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatCurrency } from "@/lib/formatters";
import type { SpendingByCategoryOverTime } from "@/types/models";

interface CategoryOverTimeChartProps {
  data: SpendingByCategoryOverTime[];
  granularity: string;
  chartType: "area" | "bar" | "line";
  highlightedCategory?: string | null;
  visibleCategories?: string[];
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
  payload?: Array<{ dataKey: string; value: number }>;
  label?: string;
  granularity: string;
  categoryMeta: CategoryMeta[];
}) {
  if (!active || !payload?.length || !label) return null;

  const sorted = [...payload]
    .filter((p) => p.value > 0)
    .sort((a, b) => b.value - a.value);
  const total = sorted.reduce((sum, p) => sum + p.value, 0);
  const colorMap = new Map(categoryMeta.map((c) => [c.name, c.color]));

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
          <span className="font-medium">{formatCurrency(entry.value)}</span>
        </div>
      ))}
      <div className="mt-1.5 border-t pt-1.5 text-sm font-medium">
        Total: {formatCurrency(total)}
      </div>
    </div>
  );
}

export function CategoryOverTimeChart({
  data,
  granularity,
  chartType,
  highlightedCategory,
  visibleCategories,
}: CategoryOverTimeChartProps) {
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
    data: chartData,
    margin: { top: 5, right: 20, left: 10, bottom: 5 },
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

  return (
    <div className="h-96" key={chartType}>
      <ResponsiveContainer width="100%" height="100%">
        {chartType === "area" ? (
          <AreaChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis {...xAxisProps} />
            <YAxis {...yAxisProps} />
            <Tooltip content={tooltipContent} />

            {renderMeta.map((cat) => (
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
          </AreaChart>
        ) : chartType === "bar" ? (
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis {...xAxisProps} />
            <YAxis {...yAxisProps} />
            <Tooltip content={tooltipContent} />

            {renderMeta.map((cat) => (
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
          </BarChart>
        ) : (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis {...xAxisProps} />
            <YAxis {...yAxisProps} />
            <Tooltip content={tooltipContent} />

            {renderMeta.map((cat) => (
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
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
