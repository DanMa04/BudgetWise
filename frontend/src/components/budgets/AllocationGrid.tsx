import { useState, useMemo } from "react";
import { CategorySliderRow } from "./CategorySliderRow";
import { CategoryGroupHeader } from "./CategoryGroupHeader";
import { GoalVerticalBar } from "./GoalVerticalBar";
import type { AllocationItem } from "./useAllocationState";

interface AllocationGridProps {
  items: AllocationItem[];
  income: number;
  onSliderChange: (id: string, amount: number) => void;
  onManualEntry: (id: string, amount: number) => void;
  onToggleLock: (id: string) => void;
}

interface CategoryGroup {
  parent: AllocationItem;
  children: AllocationItem[];
  totalAmount: number;
  totalAvg: number;
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
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const { groups, standalone } = useMemo(() => {
    const parentIds = new Set(
      categories.filter((c) => c.parentId).map((c) => c.parentId!)
    );
    const groupMap = new Map<string, CategoryGroup>();

    for (const cat of categories) {
      if (parentIds.has(cat.id)) {
        if (!groupMap.has(cat.id)) {
          groupMap.set(cat.id, {
            parent: cat,
            children: [],
            totalAmount: 0,
            totalAvg: 0,
          });
        } else {
          groupMap.get(cat.id)!.parent = cat;
        }
      }
    }

    const standalone: AllocationItem[] = [];
    for (const cat of categories) {
      if (parentIds.has(cat.id)) continue;
      if (cat.parentId && groupMap.has(cat.parentId)) {
        const group = groupMap.get(cat.parentId)!;
        group.children.push(cat);
        group.totalAmount += cat.amount;
        group.totalAvg += cat.averageSpend ?? 0;
      } else {
        standalone.push(cat);
      }
    }

    for (const group of groupMap.values()) {
      group.children.sort((a, b) => b.amount - a.amount);
    }

    const groups = Array.from(groupMap.values()).sort(
      (a, b) => b.totalAmount - a.totalAmount
    );
    standalone.sort((a, b) => b.amount - a.amount);

    return { groups, standalone };
  }, [categories]);

  function toggleGroup(parentId: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(parentId)) next.delete(parentId);
      else next.add(parentId);
      return next;
    });
  }

  if (categories.length === 0 && goals.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-muted-foreground">
        No expense categories found. Create categories first.
      </div>
    );
  }

  return (
    <div className="flex gap-6">
      {categories.length > 0 && (
        <div className="min-w-0 flex-1">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Expenses
          </h3>
          <div className="space-y-1">
            {groups.map((group) => (
              <div key={group.parent.id}>
                <CategoryGroupHeader
                  name={group.parent.name}
                  color={group.parent.color}
                  totalBudgeted={group.totalAmount}
                  totalAverageSpend={group.totalAvg}
                  isExpanded={!collapsed.has(group.parent.id)}
                  onToggle={() => toggleGroup(group.parent.id)}
                />
                {!collapsed.has(group.parent.id) && (
                  <div className="divide-y border-l-2 ml-3 pl-2">
                    {group.children.map((item) => (
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
                )}
              </div>
            ))}

            {standalone.length > 0 && (
              <div className="divide-y">
                {standalone.map((item) => (
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
            )}
          </div>
        </div>
      )}

      {goals.length > 0 && (
        <div className="shrink-0 border-l pl-6">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Goals
          </h3>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {goals.map((item) => (
              <GoalVerticalBar
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
    </div>
  );
}
