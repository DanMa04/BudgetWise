import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatCurrency } from "@/lib/formatters";
import type { SpendingByCategory } from "@/types/models";

interface SpendingPieChartProps {
  data: SpendingByCategory[];
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: SpendingByCategory }>;
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div className="rounded-lg border bg-background px-3 py-2 shadow-md">
      <p className="font-medium">{item.category_name}</p>
      <p className="text-sm text-muted-foreground">
        {formatCurrency(item.total_amount)} ({item.percentage.toFixed(1)}%)
      </p>
      <p className="text-xs text-muted-foreground">
        {item.transaction_count} transactions
      </p>
    </div>
  );
}

export function SpendingPieChart({ data }: SpendingPieChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        No data for this period
      </div>
    );
  }

  const total = data.reduce((sum, item) => sum + item.total_amount, 0);

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            dataKey="total_amount"
            nameKey="category_name"
            paddingAngle={2}
          >
            {data.map((entry) => (
              <Cell key={entry.category_id} fill={entry.category_color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <text
            x="50%"
            y="48%"
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-foreground text-lg font-bold"
          >
            {formatCurrency(total)}
          </text>
          <text
            x="50%"
            y="56%"
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-muted-foreground text-xs"
          >
            Total
          </text>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
