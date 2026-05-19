import { useState, useEffect } from "react";
import { CheckCircle2 } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

interface IncomeHeaderProps {
  income: number;
  allocated: number;
  unallocated: number;
  lockedOverBudget: boolean;
  onIncomeChange: (income: number) => void;
}

export function IncomeHeader({
  income,
  allocated,
  unallocated,
  lockedOverBudget,
  onIncomeChange,
}: IncomeHeaderProps) {
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState(income.toString());

  useEffect(() => {
    if (!editing) setInputValue(income.toString());
  }, [income, editing]);

  function handleBlur() {
    setEditing(false);
    const parsed = parseFloat(inputValue);
    if (!isNaN(parsed) && parsed >= 0) {
      onIncomeChange(Math.round(parsed));
    } else {
      setInputValue(income.toString());
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
    if (e.key === "Escape") {
      setInputValue(income.toString());
      setEditing(false);
    }
  }

  const allAllocated = unallocated <= 0.01 && !lockedOverBudget;

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-muted-foreground">
          Monthly Income
        </span>
        {editing ? (
          <div className="relative">
            <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-lg font-semibold">
              $
            </span>
            <input
              type="number"
              min={0}
              autoFocus
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              className="h-10 w-40 rounded-md border bg-background pl-6 pr-2 text-lg font-semibold tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-md px-2 py-1 text-lg font-semibold tabular-nums transition-colors hover:bg-muted"
          >
            {formatCurrency(income)}
          </button>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div className="text-sm">
          <span className="text-muted-foreground">Allocated: </span>
          <span className="font-medium tabular-nums">
            {formatCurrency(allocated)}
          </span>
        </div>

        {lockedOverBudget ? (
          <div className="rounded-md bg-red-100 px-3 py-1 text-sm font-medium text-red-700 dark:bg-red-950/40 dark:text-red-400">
            Locked amounts exceed income
          </div>
        ) : allAllocated ? (
          <div className="flex items-center gap-1.5 rounded-md bg-green-100 px-3 py-1 text-sm font-medium text-green-700 dark:bg-green-950/40 dark:text-green-400">
            <CheckCircle2 className="h-4 w-4" />
            Every dollar has a job!
          </div>
        ) : (
          <div className="text-sm">
            <span className="text-muted-foreground">Unallocated: </span>
            <span className="font-medium tabular-nums text-amber-600 dark:text-amber-400">
              {formatCurrency(unallocated)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
