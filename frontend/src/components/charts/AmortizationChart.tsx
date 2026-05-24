import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { formatCurrency } from "@/lib/formatters";
import type { AmortizationRow } from "@/types/models";

interface AmortizationChartProps {
  scheduleMinOnly: AmortizationRow[];
  scheduleWithExtra: AmortizationRow[];
  monthsSaved: number;
  interestSaved: number;
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
          {entry.dataKey === "min_only" ? "Min only" : "With extra"}:{" "}
          {formatCurrency(entry.value)}
        </p>
      ))}
    </div>
  );
}

export function AmortizationChart({
  scheduleMinOnly,
  scheduleWithExtra,
  monthsSaved,
  interestSaved,
}: AmortizationChartProps) {
  const maxMonths = Math.max(scheduleMinOnly.length, scheduleWithExtra.length);
  const data = Array.from({ length: maxMonths }, (_, i) => ({
    month: i + 1,
    min_only: scheduleMinOnly[i]?.remaining_balance ?? 0,
    with_extra: scheduleWithExtra[i]?.remaining_balance ?? 0,
  }));

  const showComparison = scheduleWithExtra.length > 0 && monthsSaved > 0;

  return (
    <div className="space-y-3">
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11 }}
            label={{ value: "Months", position: "insideBottom", offset: -5, fontSize: 11 }}
          />
          <YAxis
            tick={{ fontSize: 11 }}
            tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 11 }}
            formatter={(value: string) =>
              value === "min_only" ? "Minimum only" : "With extra payments"
            }
          />
          <Area
            type="monotone"
            dataKey="min_only"
            stroke="#ef4444"
            fill="#ef4444"
            fillOpacity={0.15}
            strokeWidth={2}
          />
          {showComparison && (
            <Area
              type="monotone"
              dataKey="with_extra"
              stroke="#22c55e"
              fill="#22c55e"
              fillOpacity={0.15}
              strokeWidth={2}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>

      {showComparison && (
        <div className="flex gap-4 rounded-lg border bg-muted/50 p-3 text-sm">
          <div>
            <span className="text-muted-foreground">Months saved: </span>
            <span className="font-semibold text-green-600">{monthsSaved}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Interest saved: </span>
            <span className="font-semibold text-green-600">
              {formatCurrency(interestSaved)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
