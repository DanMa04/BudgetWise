import { CategorySliderRow } from "./CategorySliderRow";
import { GoalAllocationRow } from "./GoalAllocationRow";
import type { AllocationItem } from "./useAllocationState";

interface AllocationGridProps {
  items: AllocationItem[];
  income: number;
  onSliderChange: (id: string, amount: number) => void;
  onManualEntry: (id: string, amount: number) => void;
  onToggleLock: (id: string) => void;
}

export function AllocationGrid({
  items,
  income,
  onSliderChange,
  onManualEntry,
  onToggleLock,
}: AllocationGridProps) {
  const categories = items.filter((it) => it.type === "category");
  const goals = items.filter((it) => it.type === "goal");

  return (
    <div className="space-y-6">
      {categories.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Expenses
          </h3>
          <div className="divide-y">
            {categories.map((item) => (
              <CategorySliderRow
                key={item.id}
                item={item}
                maxSlider={income}
                onSliderChange={onSliderChange}
                onManualEntry={onManualEntry}
                onToggleLock={onToggleLock}
              />
            ))}
          </div>
        </div>
      )}

      {goals.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Savings Goals
          </h3>
          <div className="divide-y">
            {goals.map((item) => (
              <GoalAllocationRow
                key={item.id}
                item={item}
                maxSlider={income}
                onSliderChange={onSliderChange}
                onManualEntry={onManualEntry}
                onToggleLock={onToggleLock}
              />
            ))}
          </div>
        </div>
      )}

      {categories.length === 0 && goals.length === 0 && (
        <div className="flex h-32 items-center justify-center text-muted-foreground">
          No expense categories found. Create categories first.
        </div>
      )}
    </div>
  );
}
