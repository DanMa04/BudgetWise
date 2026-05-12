import {
  BarChart,
  Bar,
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
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
        >
          <XAxis
            type="number"
            tickFormatter={(val: number) => `$${val}`}
            className="text-xs"
            tick={{ fontSize: 12 }}
          />
          <YAxis
            type="category"
            dataKey="description"
            width={120}
            className="text-xs"
            tick={{ fontSize: 12 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="total_amount" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
