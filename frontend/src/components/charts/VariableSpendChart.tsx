import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { formatCurrency } from "@/lib/formatters";
import type { VariableSpendSummary } from "@/types/models";

interface VariableSpendChartProps {
  data: VariableSpendSummary;
}

function formatDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length || !label) return null;
  return (
    <div className="rounded-lg border bg-background px-3 py-2 shadow-md text-sm space-y-1">
      <p className="font-medium">{formatDate(label)}</p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color }}>
          {entry.name}: {formatCurrency(entry.value)}
        </p>
      ))}
    </div>
  );
}

export function VariableSpendChart({ data }: VariableSpendChartProps) {
  if (data.days.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-muted-foreground text-sm">
        No data for this period
      </div>
    );
  }

  const savingsPositive = data.total_savings_vs_baseline >= 0;
  const budgetPositive = data.total_savings_vs_budget >= 0;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">vs. Avg Baseline</p>
          <p
            className={`text-lg font-semibold tabular-nums ${
              savingsPositive ? "text-green-600" : "text-red-500"
            }`}
          >
            {savingsPositive ? "+" : ""}
            {formatCurrency(data.total_savings_vs_baseline)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">vs. Variable Budget</p>
          <p
            className={`text-lg font-semibold tabular-nums ${
              budgetPositive ? "text-green-600" : "text-red-500"
            }`}
          >
            {budgetPositive ? "+" : ""}
            {formatCurrency(data.total_savings_vs_budget)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Avg daily baseline</p>
          <p className="font-medium tabular-nums">
            {formatCurrency(data.avg_daily_baseline)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Budget daily target</p>
          <p className="font-medium tabular-nums">
            {data.budget_daily_target > 0
              ? formatCurrency(data.budget_daily_target)
              : "—"}
          </p>
        </div>
      </div>

      {!data.has_baseline_data && (
        <p className="text-xs text-muted-foreground italic">
          Not enough history to compute baseline — showing cumulative spend vs budget only.
        </p>
      )}

      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data.days} margin={{ top: 4, right: 8, left: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              tick={{ fontSize: 11 }}
              interval="preserveStartEnd"
            />
            <YAxis
              tickFormatter={(v: number) => `$${Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0)}`}
              tick={{ fontSize: 11 }}
              width={52}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 2" />
            <Area
              type="monotone"
              dataKey="cumulative_savings"
              name="vs. Baseline"
              stroke="hsl(var(--primary))"
              fill="hsl(var(--primary))"
              fillOpacity={0.15}
              strokeWidth={2}
              dot={false}
              isAnimationActive={true}
              animationDuration={500}
            />
            {data.budget_daily_target > 0 && (
              <Line
                type="monotone"
                dataKey="cumulative_budget_savings"
                name="vs. Budget"
                stroke="hsl(142 71% 45%)"
                strokeWidth={1.5}
                strokeDasharray="5 3"
                dot={false}
                isAnimationActive={true}
                animationDuration={500}
              />
            )}
            <Legend
              iconSize={10}
              wrapperStyle={{ fontSize: 11 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
