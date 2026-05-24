import { useState, useEffect } from "react";
import { Lock, Unlock } from "lucide-react";
import { BudgetSlider } from "./BudgetSlider";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { AllocationItem } from "./useAllocationState";

interface CategorySliderRowProps {
  item: AllocationItem;
  maxSlider: number;
  onSliderChange: (id: string, amount: number) => void;
  onManualEntry: (id: string, amount: number) => void;
  onToggleLock: (id: string) => void;
}

export function CategorySliderRow({
  item,
  maxSlider,
  onSliderChange,
  onManualEntry,
  onToggleLock,
}: CategorySliderRowProps) {
  const [inputValue, setInputValue] = useState(item.amount.toFixed(0));
  const [hovered, setHovered] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);

  useEffect(() => {
    setInputValue(item.amount.toFixed(0));
  }, [item.amount]);

  function handleInputBlur() {
    const parsed = parseFloat(inputValue);
    if (!isNaN(parsed) && parsed >= 0) {
      onManualEntry(item.id, Math.round(parsed));
    } else {
      setInputValue(item.amount.toFixed(0));
    }
  }

  function handleInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      (e.target as HTMLInputElement).blur();
    }
  }

  return (
    <div
      className="flex items-center gap-3 py-2"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex w-36 shrink-0 items-center gap-2">
        <div
          className="h-3 w-3 shrink-0 rounded-full"
          style={{ backgroundColor: item.color || "#6b7280" }}
        />
        <span className="truncate text-sm font-medium">{item.name}</span>
      </div>

      <div className="flex-1">
        <BudgetSlider
          value={item.amount}
          max={maxSlider}
          color={item.color || "#6b7280"}
          ghostMarkerValue={item.averageSpend}
          disabled={item.isLocked}
          onChange={(val) => onSliderChange(item.id, val)}
        />
      </div>

      <div className="w-24 shrink-0">
        <div className="relative">
          <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            $
          </span>
          <input
            type="number"
            min={0}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleInputKeyDown}
            className="h-8 w-full rounded-md border bg-background pl-5 pr-2 text-right text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-ring"
            onFocus={() => setInputFocused(true)}
            onBlur={() => { setInputFocused(false); handleInputBlur(); }}
          />
        </div>
        {item.averageSpend != null && item.averageSpend > 0 && (
          <p
            className={cn(
              "mt-0.5 text-right text-[10px] tabular-nums text-muted-foreground transition-opacity duration-150",
              hovered || inputFocused ? "opacity-100" : "opacity-0",
            )}
          >
            avg {formatCurrency(item.averageSpend)}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={() => onToggleLock(item.id)}
        className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        title={item.isLocked ? "Unlock" : "Lock"}
      >
        {item.isLocked ? (
          <Lock className="h-4 w-4" />
        ) : (
          <Unlock className="h-4 w-4" />
        )}
      </button>

    </div>
  );
}
