import { useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatCurrency } from "@/lib/formatters";
import type { CategoryVendor } from "@/types/models";

interface VendorPieChartProps {
  data: CategoryVendor[];
}

const VENDOR_COLORS = [
  "#8b5cf6", "#f59e0b", "#10b981", "#ef4444", "#3b82f6",
  "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16",
  "#06b6d4", "#e11d48", "#a855f7", "#22c55e", "#eab308",
  "#0ea5e9", "#d946ef", "#64748b", "#fb923c", "#2dd4bf",
];

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: CategoryVendor }>;
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div className="rounded-lg border bg-background px-3 py-2 shadow-md">
      <p className="font-medium capitalize">{item.description}</p>
      <p className="text-sm text-muted-foreground">
        {formatCurrency(item.total_amount)} ({item.percentage.toFixed(1)}%)
      </p>
      <p className="text-xs text-muted-foreground">
        {item.transaction_count} transactions
      </p>
    </div>
  );
}

export function VendorPieChart({ data }: VendorPieChartProps) {
  const total = useMemo(
    () => data.reduce((sum, item) => sum + item.total_amount, 0),
    [data],
  );

  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        No vendor data for this category
      </div>
    );
  }

  return (
    <div className="h-[28rem]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={70}
            outerRadius={130}
            dataKey="total_amount"
            nameKey="description"
            paddingAngle={2}
            isAnimationActive={true}
            animationDuration={600}
            animationEasing="ease-in-out"
          >
            {data.map((entry, index) => (
              <Cell
                key={entry.description}
                fill={VENDOR_COLORS[index % VENDOR_COLORS.length]}
              />
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
