import { useState, useEffect } from "react";
import { Lock, Unlock } from "lucide-react";
import { Slider } from "@base-ui/react/slider";
import { formatCurrency } from "@/lib/formatters";
import type { AllocationItem } from "./useAllocationState";

interface GoalVerticalBarProps {
  item: AllocationItem;
  maxSlider: number;
  onSliderChange: (id: string, amount: number) => void;
  onManualEntry: (id: string, amount: number) => void;
  onToggleLock: (id: string) => void;
}

function estimateCompletion(item: AllocationItem): string | null {
  if (!item.targetAmount || item.amount <= 0) return null;
  const remaining = Math.max(0, item.targetAmount - (item.currentAmount || 0));
  if (remaining <= 0) return "Complete!";
  const months = Math.ceil(remaining / item.amount);
  if (months <= 1) return "~1 month";
  if (months < 12) return `~${months} months`;
  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  if (remMonths === 0) return `~${years}y`;
  return `~${years}y ${remMonths}m`;
}

export function GoalVerticalBar({
  item,
  maxSlider,
  onSliderChange,
  onManualEntry,
  onToggleLock,
}: GoalVerticalBarProps) {
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
    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
  }

  const percentage =
    item.targetAmount && item.targetAmount > 0
      ? ((item.currentAmount || 0) / item.targetAmount) * 100
      : 0;

  const remaining = Math.max(0, (item.targetAmount || 0) - (item.currentAmount || 0));
  const fillColor = item.color || "#8b5cf6";
  const estimate = estimateCompletion(item);

  return (
    <div className="flex w-28 flex-col items-center gap-2">
      <span className="text-center text-xs font-medium leading-tight">
        {item.name}
      </span>

      <div className="relative flex h-40 w-10 items-end justify-center overflow-hidden rounded-lg bg-muted">
        <div
          className="absolute bottom-0 w-full rounded-b-lg transition-all duration-300"
          style={{
            height: `${Math.min(percentage, 100)}%`,
            backgroundColor: fillColor,
            opacity: 0.3,
          }}
        />
        <Slider.Root
          value={item.amount}
          min={0}
          max={Math.max(maxSlider, 1)}
          step={1}
          disabled={item.isLocked}
          orientation="vertical"
          onValueChange={(val: number) => onSliderChange(item.id, Math.round(val))}
          className="relative flex h-full w-full items-center justify-center"
        >
          <Slider.Control className="relative flex h-full w-full items-center justify-center">
            <Slider.Track className="relative h-full w-3 rounded-full bg-transparent">
              <Slider.Indicator
                className="absolute bottom-0 w-full rounded-full transition-all duration-150"
                style={{ backgroundColor: fillColor }}
              />
              <Slider.Thumb className="block h-4 w-4 rounded-full border-2 border-background bg-foreground shadow-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </Slider.Track>
          </Slider.Control>
        </Slider.Root>
      </div>

      <div className="w-20">
        <div className="relative">
          <span className="pointer-events-none absolute left-1.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            $
          </span>
          <input
            type="number"
            min={0}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onBlur={handleInputBlur}
            onKeyDown={handleInputKeyDown}
            className="h-7 w-full rounded-md border bg-background pl-4 pr-1 text-right text-xs tabular-nums focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={() => onToggleLock(item.id)}
        className="rounded-md p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        title={item.isLocked ? "Unlock" : "Lock"}
      >
        {item.isLocked ? (
          <Lock className="h-3.5 w-3.5" />
        ) : (
          <Unlock className="h-3.5 w-3.5" />
        )}
      </button>

      {estimate && (
        <span className="text-center text-[10px] font-medium text-muted-foreground">
          {estimate}
        </span>
      )}

      <div className="text-center text-[10px] text-muted-foreground">
        <div>{Math.round(percentage)}% saved</div>
        <div>{formatCurrency(remaining)} left</div>
      </div>
    </div>
  );
}
