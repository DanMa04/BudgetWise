import { forwardRef } from "react";
import { Shield } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { CategoryWithSpend } from "@/types/models";

interface CategoryCardProps {
  category: CategoryWithSpend;
  isSelected?: boolean;
  isOverlay?: boolean;
  isDropTarget?: boolean;
  style?: React.CSSProperties;
  listeners?: Record<string, Function>;
  attributes?: Record<string, unknown>;
}

export const CategoryCard = forwardRef<HTMLDivElement, CategoryCardProps>(
  function CategoryCard(
    {
      category,
      isSelected = false,
      isOverlay = false,
      isDropTarget = false,
      style,
      listeners,
      attributes,
    },
    ref
  ) {
    const color = category.color || "#6b7280";

    return (
      <div
        ref={ref}
        style={style}
        {...listeners}
        {...attributes}
        className={cn(
          "relative flex min-h-[80px] cursor-grab flex-col justify-between rounded-lg border p-3 transition-all duration-150 active:cursor-grabbing",
          isOverlay && "shadow-xl opacity-90 scale-[1.02]",
          isDropTarget &&
            "ring-2 ring-primary ring-offset-2 scale-[1.03] bg-primary/5",
          isSelected && "ring-2 ring-blue-500 ring-offset-2",
          !isOverlay && !isDropTarget && !isSelected && "hover:shadow-md",
          category.is_system && "opacity-80"
        )}
      >
        <div
          className="absolute left-0 top-0 h-full w-1 rounded-l-lg"
          style={{ backgroundColor: color }}
        />

        <div className="flex items-start gap-2 pl-2">
          <span className="text-sm font-medium leading-tight">
            {category.name}
          </span>
          {category.is_system && (
            <Shield className="h-3 w-3 shrink-0 text-muted-foreground" />
          )}
        </div>

        <div className="mt-1 pl-2">
          <span className="text-sm font-semibold tabular-nums">
            {formatCurrency(category.total_spend)}
          </span>
          <span className="ml-1 text-[10px] text-muted-foreground">
            {category.transaction_count} txn{category.transaction_count !== 1 && "s"}
          </span>
        </div>
      </div>
    );
  }
);
