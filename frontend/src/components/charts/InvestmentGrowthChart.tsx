import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceDot,
} from "recharts";
import { formatCurrency } from "@/lib/formatters";
import type { InvestmentRow } from "@/types/models";

interface InvestmentGrowthChartProps {
  projection: InvestmentRow[];
  balance5y: number;
  balance10y: number;
  balance20y: number;
  balance30y: number;
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string }>;
}) {
  if (!active || !payload?.length) return null;
  const contributions =
    payload.find((p) => p.dataKey === "contributions_total")?.value ?? 0;
  const growth =
    payload.find((p) => p.dataKey === "growth_total")?.value ?? 0;
  const balance =
    payload.find((p) => p.dataKey === "balance")?.value ?? 0;

  return (
    <div className="rounded-lg border bg-background px-3 py-2 shadow-md">
      <p className="text-sm font-semibold">{formatCurrency(balance)}</p>
      <p className="text-xs text-blue-600">
        Contributions: {formatCurrency(contributions)}
      </p>
      <p className="text-xs text-emerald-600">
        Growth: {formatCurrency(growth)}
      </p>
    </div>
  );
}

export function InvestmentGrowthChart({
  projection,
  balance5y,
  balance10y,
  balance20y,
  balance30y,
}: InvestmentGrowthChartProps) {
  const yearlyData = projection.filter((_, i) => (i + 1) % 12 === 0).map((row) => ({
    year: row.month / 12,
    ...row,
  }));

  return (
    <div className="space-y-3">
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={yearlyData}>
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis
            dataKey="year"
            tick={{ fontSize: 11 }}
            label={{ value: "Years", position: "insideBottom", offset: -5, fontSize: 11 }}
          />
          <YAxis
            tick={{ fontSize: 11 }}
            tickFormatter={(v: number) =>
              v >= 1_000_000
                ? `$${(v / 1_000_000).toFixed(1)}M`
                : `$${(v / 1000).toFixed(0)}k`
            }
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="contributions_total"
            stackId="1"
            stroke="#3b82f6"
            fill="#3b82f6"
            fillOpacity={0.3}
            strokeWidth={0}
          />
          <Area
            type="monotone"
            dataKey="growth_total"
            stackId="1"
            stroke="#10b981"
            fill="#10b981"
            fillOpacity={0.2}
            strokeWidth={0}
          />
          <Area
            type="monotone"
            dataKey="balance"
            stroke="#3b82f6"
            fill="none"
            strokeWidth={2}
          />
          {[5, 10, 20, 30].map((y) => {
            const point = yearlyData.find((d) => d.year === y);
            if (!point) return null;
            return (
              <ReferenceDot
                key={y}
                x={y}
                y={point.balance}
                r={4}
                fill="#3b82f6"
                stroke="#fff"
                strokeWidth={2}
              />
            );
          })}
        </AreaChart>
      </ResponsiveContainer>

      <div className="grid grid-cols-4 gap-2 text-center text-xs">
        {[
          { label: "5 years", value: balance5y },
          { label: "10 years", value: balance10y },
          { label: "20 years", value: balance20y },
          { label: "30 years", value: balance30y },
        ].map((m) => (
          <div key={m.label} className="rounded-lg border p-2">
            <div className="text-muted-foreground">{m.label}</div>
            <div className="font-semibold">{formatCurrency(m.value)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
