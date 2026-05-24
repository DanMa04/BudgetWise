import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { formatCurrency } from "@/lib/formatters";
import type { MultiDebtStrategyResponse } from "@/types/models";

interface DebtStrategyChartProps {
  data: MultiDebtStrategyResponse;
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string; color: string }>;
  label?: number;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-background px-3 py-2 shadow-md">
      <p className="text-sm font-medium">Month {label}</p>
      {payload.map((entry) => (
        <p
          key={entry.dataKey}
          className="text-sm"
          style={{ color: entry.color }}
        >
          {entry.dataKey === "avalanche" ? "Avalanche" : "Snowball"}:{" "}
          {formatCurrency(entry.value)}
        </p>
      ))}
    </div>
  );
}

export function DebtStrategyChart({ data }: DebtStrategyChartProps) {
  const maxMonths = Math.max(
    data.avalanche.total_months,
    data.snowball.total_months
  );

  const chartData = Array.from({ length: maxMonths }, (_, i) => ({
    month: i + 1,
    avalanche: data.avalanche.timeline[i]?.total_balance ?? 0,
    snowball: data.snowball.timeline[i]?.total_balance ?? 0,
  }));

  const avalancheBetter =
    data.avalanche.total_interest < data.snowball.total_interest;

  return (
    <div className="space-y-3">
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11 }}
            label={{
              value: "Months",
              position: "insideBottom",
              offset: -5,
              fontSize: 11,
            }}
          />
          <YAxis
            tick={{ fontSize: 11 }}
            tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            type="monotone"
            dataKey="avalanche"
            name="Avalanche (highest rate first)"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="snowball"
            name="Snowball (smallest balance first)"
            stroke="#f59e0b"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>

      <div className="grid grid-cols-2 gap-3">
        <div
          className={`rounded-lg border p-3 ${avalancheBetter ? "border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950" : ""}`}
        >
          <div className="text-sm font-semibold text-blue-600">Avalanche</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {data.avalanche.total_months} months ·{" "}
            {formatCurrency(data.avalanche.total_interest)} interest
          </div>
          {avalancheBetter && (
            <div className="mt-1 text-xs font-medium text-blue-600">
              Saves {formatCurrency(data.interest_difference)} in interest
            </div>
          )}
        </div>
        <div
          className={`rounded-lg border p-3 ${!avalancheBetter ? "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950" : ""}`}
        >
          <div className="text-sm font-semibold text-amber-600">Snowball</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {data.snowball.total_months} months ·{" "}
            {formatCurrency(data.snowball.total_interest)} interest
          </div>
          {!avalancheBetter && (
            <div className="mt-1 text-xs font-medium text-amber-600">
              Saves {formatCurrency(data.interest_difference)} in interest
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
