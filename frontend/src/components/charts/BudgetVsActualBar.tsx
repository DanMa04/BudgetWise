import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { formatCurrency } from "@/lib/formatters";
import type { BudgetVsActual } from "@/types/models";

interface BudgetVsActualBarProps {
  data: BudgetVsActual[];
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
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-background px-3 py-2 shadow-md">
      <p className="font-medium">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="text-sm" style={{ color: entry.color }}>
          {entry.name}: {formatCurrency(entry.value)}
        </p>
      ))}
    </div>
  );
}

export function BudgetVsActualBar({ data }: BudgetVsActualBarProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        No data for this period
      </div>
    );
  }

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="category_name"
            className="text-xs"
            tick={{ fontSize: 12 }}
          />
          <YAxis
            tickFormatter={(val: number) => `$${val}`}
            className="text-xs"
            tick={{ fontSize: 12 }}
            width={60}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="budgeted_amount" name="Budgeted" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          <Bar dataKey="actual_amount" name="Actual" radius={[4, 4, 0, 0]}>
            {data.map((entry) => (
              <Cell
                key={entry.budget_id}
                fill={entry.actual_amount > entry.budgeted_amount ? "#ef4444" : "#22c55e"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
