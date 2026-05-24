import { useMemo } from "react";
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatCurrency } from "@/lib/formatters";
import type { TopMerchant } from "@/types/models";

interface TopMerchantsChartProps {
  data: TopMerchant[];
}

const MERCHANT_COLORS = [
  "#8b5cf6", "#f59e0b", "#10b981", "#ef4444", "#3b82f6",
  "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16",
  "#06b6d4", "#e11d48", "#a855f7", "#22c55e", "#eab308",
  "#0ea5e9", "#d946ef", "#64748b", "#fb923c", "#2dd4bf",
];

function seededColor(str: string, index: number): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash + index) % MERCHANT_COLORS.length;
  return MERCHANT_COLORS[idx];
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: TopMerchant }>;
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div className="rounded-lg border bg-background px-3 py-2 shadow-md">
      <p className="font-medium">{item.description}</p>
      <p className="text-sm text-muted-foreground">
        {formatCurrency(item.total_amount)}
      </p>
      <p className="text-xs text-muted-foreground">
        {item.transaction_count} transactions
      </p>
    </div>
  );
}

export function TopMerchantsChart({ data }: TopMerchantsChartProps) {
  const colorMap = useMemo(
    () => data.map((d, i) => seededColor(d.description, i)),
    [data],
  );

  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        No data for this period
      </div>
    );
  }

  return (
    <div className="h-[28rem]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 5, right: 20, left: 5, bottom: 5 }}
        >
          <XAxis
            type="number"
            tickFormatter={(val: number) => `$${val}`}
            className="text-xs"
            tick={{ fontSize: 11 }}
          />
          <YAxis
            type="category"
            dataKey="description"
            width={110}
            className="text-xs"
            tick={{ fontSize: 11 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="total_amount" radius={[0, 4, 4, 0]} isAnimationActive={true} animationDuration={600} animationEasing="ease-in-out">
            {data.map((entry, index) => (
              <Cell key={entry.description} fill={colorMap[index]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
