import { useState, useEffect } from "react";
import { Lock, Unlock } from "lucide-react";
import { BudgetSlider } from "./BudgetSlider";
import { GoalProgressRing } from "@/components/goals/GoalProgressRing";
import { formatCurrency } from "@/lib/formatters";
import type { AllocationItem } from "./useAllocationState";

interface GoalAllocationRowProps {
  item: AllocationItem;
  maxSlider: number;
  onSliderChange: (id: string, amount: number) => void;
  onManualEntry: (id: string, amount: number) => void;
  onToggleLock: (id: string) => void;
}

export function GoalAllocationRow({
  item,
  maxSlider,
  onSliderChange,
  onManualEntry,
  onToggleLock,
}: GoalAllocationRowProps) {
  const [inputValue, setInputValue] = useState(item.amount.toFixed(0));

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

  const percentage =
    item.targetAmount && item.targetAmount > 0
      ? ((item.currentAmount || 0) / item.targetAmount) * 100
      : 0;

  const remaining = (item.targetAmount || 0) - (item.currentAmount || 0);

  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex w-36 shrink-0 items-center gap-2">
        <GoalProgressRing
          percentage={percentage}
          size={28}
          strokeWidth={3}
          color={item.color || undefined}
        />
        <span className="truncate text-sm font-medium">{item.name}</span>
      </div>

      <div className="flex-1">
        <BudgetSlider
          value={item.amount}
          max={maxSlider}
          color={item.color || "#8b5cf6"}
          ghostMarkerValue={item.monthlyRate}
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
            onBlur={handleInputBlur}
            onKeyDown={handleInputKeyDown}
            className="h-8 w-full rounded-md border bg-background pl-5 pr-2 text-right text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
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

      <span className="hidden w-20 shrink-0 text-right text-xs text-muted-foreground lg:block">
        {formatCurrency(remaining)} left
      </span>
    </div>
  );
}
