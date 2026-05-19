import type { AllocationItem } from "./useAllocationState";

interface AllocationSummaryBarProps {
  items: AllocationItem[];
  income: number;
}

export function AllocationSummaryBar({
  items,
  income,
}: AllocationSummaryBarProps) {
  if (income <= 0) return null;

  const segments = items
    .filter((it) => it.amount > 0)
    .map((it) => ({
      id: it.id,
      name: it.name,
      color: it.color || (it.type === "goal" ? "#8b5cf6" : "#6b7280"),
      percent: (it.amount / income) * 100,
      type: it.type,
    }));

  const allocatedPercent = segments.reduce((sum, s) => sum + s.percent, 0);
  const unallocatedPercent = Math.max(0, 100 - allocatedPercent);

  return (
    <div className="space-y-2">
      <div className="flex h-4 w-full overflow-hidden rounded-full bg-muted">
        {segments.map((seg) => (
          <div
            key={seg.id}
            className="h-full transition-all duration-300"
            style={{
              width: `${seg.percent}%`,
              backgroundColor: seg.color,
              opacity: seg.type === "goal" ? 0.7 : 1,
            }}
            title={`${seg.name}: ${seg.percent.toFixed(1)}%`}
          />
        ))}
        {unallocatedPercent > 0.5 && (
          <div
            className="h-full bg-muted-foreground/20 transition-all duration-300"
            style={{ width: `${unallocatedPercent}%` }}
            title={`Unallocated: ${unallocatedPercent.toFixed(1)}%`}
          />
        )}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {segments.slice(0, 8).map((seg) => (
          <div key={seg.id} className="flex items-center gap-1.5">
            <div
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: seg.color }}
            />
            <span className="text-xs text-muted-foreground">
              {seg.name} {seg.percent.toFixed(0)}%
            </span>
          </div>
        ))}
        {segments.length > 8 && (
          <span className="text-xs text-muted-foreground">
            +{segments.length - 8} more
          </span>
        )}
      </div>
    </div>
  );
}
