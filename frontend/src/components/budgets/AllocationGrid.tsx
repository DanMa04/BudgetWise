import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Lock, Unlock } from "lucide-react";
import { CategorySliderRow } from "./CategorySliderRow";
import { GoalVerticalBar } from "./GoalVerticalBar";
import { formatCurrency } from "@/lib/formatters";
import type { AllocationItem } from "./useAllocationState";

interface AllocationGridProps {
  items: AllocationItem[];
  income: number;
  onSliderChange: (id: string, amount: number) => void;
  onManualEntry: (id: string, amount: number) => void;
  onToggleLock: (id: string) => void;
  onSetGroupAmounts: (
    updates: Array<{ id: string; amount: number }>
  ) => void;
}

interface CategoryGroup {
  parent: AllocationItem;
  children: AllocationItem[];
  totalAmount: number;
  totalAvg: number;
}

interface DragState {
  handleIndex: number;
  startX: number;
  adjustedId: string;
  adjustedStart: number;
  otherIds: string[];
  otherStarts: number[];
  otherTotal: number;
  barWidth: number;
  groupTotal: number;
}

function GroupAllocationBar({
  group,
  onSetGroupAmounts,
  onManualEntry,
  onToggleLock,
}: {
  group: CategoryGroup;
  onSetGroupAmounts: (
    updates: Array<{ id: string; amount: number }>
  ) => void;
  onManualEntry: (id: string, amount: number) => void;
  onToggleLock: (id: string) => void;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const setGroupRef = useRef(onSetGroupAmounts);
  setGroupRef.current = onSetGroupAmounts;
  const stableChildOrderRef = useRef<string[]>([]);

  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [totalInput, setTotalInput] = useState(group.totalAmount.toFixed(0));
  const [editingChildId, setEditingChildId] = useState<string | null>(null);
  const [childInput, setChildInput] = useState("");
  const childInputRef = useRef<HTMLInputElement>(null);

  const children = group.children;
  const total = group.totalAmount;
  const isGroupLocked = group.parent.isLocked;

  useEffect(() => {
    setTotalInput(group.totalAmount.toFixed(0));
  }, [group.totalAmount]);

  const segments = useMemo(() => {
    let ordered = children;
    if (drag !== null && stableChildOrderRef.current.length > 0) {
      const orderMap = new Map(
        stableChildOrderRef.current.map((id, i) => [id, i]),
      );
      ordered = [...children].sort(
        (a, b) => (orderMap.get(a.id) ?? 999) - (orderMap.get(b.id) ?? 999),
      );
    }
    return ordered.map((child) => ({
      item: child,
      pct:
        total > 0
          ? (child.amount / total) * 100
          : 100 / Math.max(children.length, 1),
    }));
  }, [children, drag, total]);

  const cumPcts = useMemo(() => {
    const result: number[] = [];
    let cum = 0;
    for (const seg of segments) {
      cum += seg.pct;
      result.push(cum);
    }
    return result;
  }, [segments]);

  const startDrag = useCallback(
    (handleIndex: number, clientX: number) => {
      if (total === 0) return;
      stableChildOrderRef.current = children.map((c) => c.id);
      const adjusted = children[handleIndex];
      if (adjusted.isLocked) return;

      const others = children.filter(
        (c, j) => j !== handleIndex && !c.isLocked
      );
      if (others.length === 0) return;

      setDrag({
        handleIndex,
        startX: clientX,
        adjustedId: adjusted.id,
        adjustedStart: adjusted.amount,
        otherIds: others.map((c) => c.id),
        otherStarts: others.map((c) => c.amount),
        otherTotal: others.reduce((s, c) => s + c.amount, 0),
        barWidth: barRef.current?.offsetWidth ?? 1,
        groupTotal: total,
      });
    },
    [children, total]
  );

  useEffect(() => {
    if (!drag) return;

    function onMove(clientX: number) {
      const d = drag!;
      const deltaX = clientX - d.startX;
      const rawDelta = (deltaX / d.barWidth) * d.groupTotal;
      const clamped = Math.round(
        Math.max(-d.adjustedStart, Math.min(d.otherTotal, rawDelta))
      );
      const newAdjusted = d.adjustedStart + clamped;

      const updates: Array<{ id: string; amount: number }> = [
        { id: d.adjustedId, amount: newAdjusted },
      ];

      let remaining = -clamped;
      for (let j = 0; j < d.otherIds.length; j++) {
        if (j === d.otherIds.length - 1) {
          updates.push({
            id: d.otherIds[j],
            amount: Math.max(0, d.otherStarts[j] + remaining),
          });
        } else {
          const proportion =
            d.otherTotal > 0
              ? d.otherStarts[j] / d.otherTotal
              : 1 / d.otherIds.length;
          const change = Math.round(-clamped * proportion);
          updates.push({
            id: d.otherIds[j],
            amount: Math.max(0, d.otherStarts[j] + change),
          });
          remaining -= change;
        }
      }

      setGroupRef.current(updates);
    }

    const handleMouseMove = (e: MouseEvent) => onMove(e.clientX);
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) onMove(e.touches[0].clientX);
    };
    const handleEnd = () => setDrag(null);

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleEnd);
    document.addEventListener("touchmove", handleTouchMove, { passive: true });
    document.addEventListener("touchend", handleEnd);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleEnd);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleEnd);
    };
  }, [drag]);

  function handleTotalBlur() {
    const parsed = parseFloat(totalInput);
    if (isNaN(parsed) || parsed < 0) {
      setTotalInput(total.toFixed(0));
      return;
    }
    const newTotal = Math.round(parsed);
    if (newTotal === total) return;

    const unlocked = children.filter((c) => !c.isLocked);
    const lockedSum = children
      .filter((c) => c.isLocked)
      .reduce((s, c) => s + c.amount, 0);
    const unlockedPool = Math.max(0, newTotal - lockedSum);

    if (unlocked.length === 0) {
      setTotalInput(total.toFixed(0));
      return;
    }

    const unlockedTotal = unlocked.reduce((s, c) => s + c.amount, 0);
    const updates: Array<{ id: string; amount: number }> = [];
    let remaining = unlockedPool;

    for (let i = 0; i < unlocked.length; i++) {
      if (i === unlocked.length - 1) {
        updates.push({ id: unlocked[i].id, amount: Math.max(0, remaining) });
      } else {
        const proportion =
          unlockedTotal > 0
            ? unlocked[i].amount / unlockedTotal
            : 1 / unlocked.length;
        const amount = Math.round(unlockedPool * proportion);
        updates.push({ id: unlocked[i].id, amount });
        remaining -= amount;
      }
    }

    onSetGroupAmounts(updates);
  }

  function handleTotalKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
  }

  function handleChildClick(child: AllocationItem) {
    if (drag) return;
    setEditingChildId(child.id);
    setChildInput(child.amount.toFixed(0));
    setTimeout(() => childInputRef.current?.focus(), 0);
  }

  function commitChildEdit() {
    if (!editingChildId) return;
    const parsed = parseFloat(childInput);
    if (!isNaN(parsed) && parsed >= 0) {
      onManualEntry(editingChildId, Math.round(parsed));
    }
    setEditingChildId(null);
    setChildInput("");
  }

  function cancelChildEdit() {
    setEditingChildId(null);
    setChildInput("");
  }

  return (
    <div className="space-y-1">
      {/* Header: parent name + group lock + avg + editable total */}
      <div className="flex items-center gap-2">
        <div
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: group.parent.color || "#6b7280" }}
        />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">
          {group.parent.name}
        </span>
        <span className="text-xs tabular-nums text-muted-foreground">
          avg {formatCurrency(group.totalAvg)}
        </span>
        <div className="relative w-24 shrink-0">
          <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            $
          </span>
          <input
            type="number"
            min={0}
            value={totalInput}
            onChange={(e) => setTotalInput(e.target.value)}
            onBlur={handleTotalBlur}
            onKeyDown={handleTotalKeyDown}
            disabled={isGroupLocked}
            className="h-8 w-full rounded-md border bg-background pl-5 pr-2 text-right text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
          />
        </div>
        <button
          type="button"
          onClick={() => onToggleLock(group.parent.id)}
          className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title={isGroupLocked ? "Unlock group" : "Lock group"}
        >
          {isGroupLocked ? (
            <Lock className="h-4 w-4" />
          ) : (
            <Unlock className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Proportional bar */}
      <div
        ref={barRef}
        className="relative flex h-9 rounded-md border"
        onMouseLeave={() => {
          if (!drag) setHoveredIndex(null);
        }}
      >
        {segments.map((seg, i) => {
          const isHovered = hoveredIndex === i;
          const isDimmed =
            hoveredIndex !== null && hoveredIndex !== i && !drag;
          const isEditing = editingChildId === seg.item.id;

          return (
            <div
              key={seg.item.id}
              className="relative h-full transition-all duration-100 first:rounded-l-md last:rounded-r-md cursor-pointer"
              style={{
                width: `${seg.pct}%`,
                minWidth: seg.item.amount > 0 ? 4 : 0,
                backgroundColor: seg.item.color || "#6b7280",
                opacity: isDimmed ? 0.35 : 1,
                filter: isHovered || isEditing ? "brightness(1.15)" : undefined,
              }}
              onMouseEnter={() => {
                if (!drag) setHoveredIndex(i);
              }}
              onClick={() => handleChildClick(seg.item)}
            >
              {/* Locked overlay pattern */}
              {seg.item.isLocked && (
                <div
                  className="absolute inset-0 first:rounded-l-md last:rounded-r-md"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(255,255,255,0.1) 3px, rgba(255,255,255,0.1) 6px)",
                  }}
                />
              )}

              {/* Inline label when segment is wide enough */}
              {seg.pct > 18 && !isEditing && (
                <div className="absolute inset-0 flex items-center justify-center overflow-hidden px-1">
                  <span className="truncate text-[11px] font-medium text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
                    {seg.item.name}
                  </span>
                </div>
              )}

              {/* Hover tooltip */}
              {isHovered && !drag && !isEditing && (
                <div className="pointer-events-none absolute -top-10 left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded border bg-popover px-2 py-1 text-xs font-medium shadow-md">
                  {seg.item.name}: {formatCurrency(seg.item.amount)}
                  {seg.item.isLocked ? " 🔒" : ""}
                  {seg.item.averageSpend != null && seg.item.averageSpend > 0 && (
                    <span className="ml-1.5 font-normal text-muted-foreground">
                      avg {formatCurrency(seg.item.averageSpend)}
                    </span>
                  )}
                  <div className="text-[10px] text-muted-foreground">Click to edit</div>
                </div>
              )}

              {/* Inline edit input */}
              {isEditing && (
                <div
                  className="absolute -top-12 left-1/2 z-40 -translate-x-1/2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="rounded border bg-popover px-1.5 py-1 shadow-lg">
                    <div className="flex items-center gap-1">
                      <span className="max-w-20 truncate text-xs font-medium">{seg.item.name}</span>
                      <span className="text-xs text-muted-foreground">$</span>
                      <input
                        ref={childInputRef}
                        type="number"
                        min={0}
                        value={childInput}
                        onChange={(e) => setChildInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitChildEdit();
                          if (e.key === "Escape") cancelChildEdit();
                        }}
                        onBlur={cancelChildEdit}
                        className="h-6 w-16 rounded border bg-background px-1 text-right text-xs tabular-nums focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </div>
                    {seg.item.averageSpend != null && seg.item.averageSpend > 0 && (
                      <div className="mt-0.5 text-right text-[10px] text-muted-foreground">
                        avg {formatCurrency(seg.item.averageSpend)}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Drag handles between segments */}
        {segments.length > 1 &&
          segments.slice(0, -1).map((_, i) => {
            const leftLocked = children[i]?.isLocked;
            const otherUnlocked = children.filter(
              (c, j) => j !== i && !c.isLocked
            );
            const disabled = leftLocked || otherUnlocked.length === 0 || total === 0;
            const show =
              hoveredIndex === i ||
              hoveredIndex === i + 1 ||
              drag?.handleIndex === i;

            return (
              <div
                key={`h-${i}`}
                className="absolute top-0 z-20 flex h-full w-5 -translate-x-1/2 items-center justify-center"
                style={{
                  left: `${cumPcts[i]}%`,
                  cursor: disabled ? "default" : "col-resize",
                  opacity: show && !disabled ? 1 : 0,
                  transition: "opacity 100ms",
                }}
                onMouseEnter={() => {
                  if (!drag) setHoveredIndex(i);
                }}
                onMouseDown={(e) => {
                  if (disabled) return;
                  e.preventDefault();
                  startDrag(i, e.clientX);
                }}
                onTouchStart={(e) => {
                  if (disabled || e.touches.length === 0) return;
                  startDrag(i, e.touches[0].clientX);
                }}
              >
                <div className="h-5 w-1 rounded-full bg-white shadow-[0_0_4px_rgba(0,0,0,0.4)]" />
              </div>
            );
          })}
      </div>

      {/* Lock toggles below bar */}
      <div className="flex">
        {segments.map((seg) => (
          <button
            key={seg.item.id}
            type="button"
            onClick={() => onToggleLock(seg.item.id)}
            style={{ width: `${seg.pct}%` }}
            className="flex items-center justify-center py-0.5 text-muted-foreground transition-colors hover:text-foreground"
            title={
              seg.item.isLocked
                ? `Unlock ${seg.item.name}`
                : `Lock ${seg.item.name}`
            }
          >
            {seg.item.isLocked ? (
              <Lock className="h-3 w-3" />
            ) : (
              <Unlock className="h-3 w-3" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

export function AllocationGrid({
  items,
  income,
  onSliderChange,
  onManualEntry,
  onToggleLock,
  onSetGroupAmounts,
}: AllocationGridProps) {
  const categories = items.filter((it) => it.type === "category");
  const goals = items.filter((it) => it.type === "goal");

  const [isDragging, setIsDragging] = useState(false);
  const standaloneOrderRef = useRef<string[]>([]);
  const groupOrderRef = useRef<string[]>([]);
  const groupChildOrderRef = useRef<Map<string, string[]>>(new Map());

  const handleSliderChange = useCallback(
    (id: string, amount: number) => {
      setIsDragging(true);
      onSliderChange(id, amount);
    },
    [onSliderChange],
  );

  const handleSliderCommit = useCallback(() => {
    setIsDragging(false);
  }, []);

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

    const groups = Array.from(groupMap.values());

    if (isDragging) {
      const standaloneOrder = new Map(
        standaloneOrderRef.current.map((id, i) => [id, i]),
      );
      const groupOrder = new Map(
        groupOrderRef.current.map((id, i) => [id, i]),
      );
      standalone.sort(
        (a, b) => (standaloneOrder.get(a.id) ?? 999) - (standaloneOrder.get(b.id) ?? 999),
      );
      for (const group of groups) {
        const childOrder = new Map(
          (groupChildOrderRef.current.get(group.parent.id) ?? []).map(
            (id, i) => [id, i],
          ),
        );
        group.children.sort(
          (a, b) => (childOrder.get(a.id) ?? 999) - (childOrder.get(b.id) ?? 999),
        );
      }
      groups.sort(
        (a, b) =>
          (groupOrder.get(a.parent.id) ?? 999) -
          (groupOrder.get(b.parent.id) ?? 999),
      );
    } else {
      standalone.sort((a, b) => b.amount - a.amount);
      for (const group of groups) {
        group.children.sort((a, b) => b.amount - a.amount);
      }
      groups.sort((a, b) => b.totalAmount - a.totalAmount);

      standaloneOrderRef.current = standalone.map((s) => s.id);
      groupOrderRef.current = groups.map((g) => g.parent.id);
      for (const group of groups) {
        groupChildOrderRef.current.set(
          group.parent.id,
          group.children.map((c) => c.id),
        );
      }
    }

    return { groups, standalone };
  }, [categories, isDragging]);

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
          <div className="space-y-3">
            {groups.map((group) => (
              <GroupAllocationBar
                key={group.parent.id}
                group={group}
                onSetGroupAmounts={onSetGroupAmounts}
                onManualEntry={onManualEntry}
                onToggleLock={onToggleLock}
              />
            ))}

            {standalone.length > 0 && (
              <div className="divide-y">
                {standalone.map((item) => (
                  <CategorySliderRow
                    key={item.id}
                    item={item}
                    maxSlider={income}
                    onSliderChange={handleSliderChange}
                    onSliderCommit={handleSliderCommit}
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
