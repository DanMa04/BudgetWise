import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatCurrency } from "@/lib/formatters";
import type { SpendingTrend } from "@/types/models";

interface TrendLineChartProps {
  data: SpendingTrend[];
  granularity: string;
}

function formatLabel(period: string, granularity: string): string {
  const date = new Date(period);
  if (granularity === "daily") {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  if (granularity === "weekly") {
    return `Week of ${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  }
  return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

function CustomTooltip({
  active,
  payload,
  label,
  granularity,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
  granularity: string;
}) {
  if (!active || !payload?.length || !label) return null;
  return (
    <div className="rounded-lg border bg-background px-3 py-2 shadow-md">
      <p className="text-sm font-medium">{formatLabel(label, granularity)}</p>
      <p className="text-sm text-muted-foreground">
        {formatCurrency(payload[0].value)}
      </p>
    </div>
  );
}

export function TrendLineChart({ data, granularity }: TrendLineChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        No data for this period
      </div>
    );
  }

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="period"
            tickFormatter={(val: string) => formatLabel(val, granularity)}
            className="text-xs"
            tick={{ fontSize: 12 }}
          />
          <YAxis
            tickFormatter={(val: number) => `$${val}`}
            className="text-xs"
            tick={{ fontSize: 12 }}
            width={60}
          />
          <Tooltip content={<CustomTooltip granularity={granularity} />} />
          <Line
            type="monotone"
            dataKey="total_amount"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
