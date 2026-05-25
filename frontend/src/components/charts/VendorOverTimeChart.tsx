import { useMemo } from "react";
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
import type { VendorSpendingOverTime } from "@/types/models";

interface VendorOverTimeChartProps {
  data: VendorSpendingOverTime[];
  granularity: string;
  colorMap: Map<string, string>;
  activeVendors?: string[];
}

function formatLabel(period: string, granularity: string): string {
  if (granularity === "weekly" && /^\d{4}-W\d{2}$/.test(period)) {
    const [yearStr, weekStr] = period.split("-W");
    const jan4 = new Date(Number(yearStr), 0, 4);
    const weekStart = new Date(jan4.getTime() + (Number(weekStr) - 1) * 7 * 86400000);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
    return weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  if (granularity === "monthly" && /^\d{4}-\d{2}$/.test(period)) {
    const d = new Date(`${period}-15T12:00:00`);
    return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
  }
  const d = new Date(`${period}T12:00:00`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function CustomTooltip({
  active,
  payload,
  label,
  granularity,
  colorMap,
}: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number }>;
  label?: string;
  granularity: string;
  colorMap: Map<string, string>;
}) {
  if (!active || !payload?.length || !label) return null;

  const sorted = [...payload]
    .filter((p) => p.value > 0)
    .sort((a, b) => b.value - a.value);

  return (
    <div className="max-h-72 overflow-y-auto rounded-lg border bg-background px-3 py-2 shadow-md">
      <p className="mb-1.5 text-sm font-medium">{formatLabel(label, granularity)}</p>
      {sorted.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2 text-sm">
          <span
            className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full"
            style={{ backgroundColor: colorMap.get(entry.dataKey) ?? "#9ca3af" }}
          />
          <span className="flex-1 truncate capitalize text-muted-foreground">
            {entry.dataKey}
          </span>
          <span className="font-medium">{formatCurrency(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function VendorOverTimeChart({
  data,
  granularity,
  colorMap,
  activeVendors,
}: VendorOverTimeChartProps) {
  const { chartData, vendorNames } = useMemo(() => {
    const names = new Set<string>();
    const rows = data.map((period) => {
      const row: Record<string, string | number> = { period: period.period };
      for (const v of period.vendors) {
        row[v.vendor_name] = v.amount;
        names.add(v.vendor_name);
      }
      return row;
    });
    for (const row of rows) {
      for (const name of names) {
        if (!(name in row)) row[name] = 0;
      }
    }
    return { chartData: rows, vendorNames: Array.from(names) };
  }, [data]);

  const renderVendors = useMemo(() => {
    if (activeVendors && activeVendors.length > 0) {
      return vendorNames.filter((n) => activeVendors.includes(n));
    }
    return vendorNames;
  }, [vendorNames, activeVendors]);

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
        <LineChart
          data={chartData}
          margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="period"
            tickFormatter={(val: string) => formatLabel(val, granularity)}
            tick={{ fontSize: 12 }}
          />
          <YAxis
            tickFormatter={(val: number) => `$${val}`}
            tick={{ fontSize: 12 }}
            width={60}
          />
          <Tooltip
            content={
              <CustomTooltip granularity={granularity} colorMap={colorMap} />
            }
          />
          {renderVendors.map((name) => (
            <Line
              key={name}
              type="monotone"
              dataKey={name}
              stroke={colorMap.get(name) ?? "#9ca3af"}
              strokeWidth={2}
              dot={{ r: 2 }}
              activeDot={{ r: 4 }}
              isAnimationActive={true}
              animationDuration={600}
              animationEasing="ease-in-out"
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
