import { ChevronRight } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";

interface CategoryGroupHeaderProps {
  name: string;
  color: string | null;
  totalBudgeted: number;
  totalAverageSpend: number;
  isExpanded: boolean;
  onToggle: () => void;
}

export function CategoryGroupHeader({
  name,
  color,
  totalBudgeted,
  totalAverageSpend,
  isExpanded,
  onToggle,
}: CategoryGroupHeaderProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-left transition-colors hover:bg-muted"
    >
      <div
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: color || "#6b7280" }}
      />
      <span className="min-w-0 flex-1 truncate text-sm font-semibold">
        {name}
      </span>
      <span className="text-sm font-medium tabular-nums">
        {formatCurrency(totalBudgeted)}
      </span>
      <span
        className={cn(
          "text-xs tabular-nums",
          totalAverageSpend > totalBudgeted
            ? "text-red-500"
            : "text-muted-foreground"
        )}
      >
        avg {formatCurrency(totalAverageSpend)}
      </span>
      <ChevronRight
        className={cn(
          "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
          isExpanded && "rotate-90"
        )}
      />
    </button>
  );
}
