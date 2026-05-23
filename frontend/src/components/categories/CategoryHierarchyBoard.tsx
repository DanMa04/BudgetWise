import { useState, useMemo, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import type { DragStartEvent, DragEndEvent } from "@dnd-kit/core";
import { Search, Unlink, ListFilter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { CategoryCard } from "./CategoryCard";
import { MergeConfirmDialog } from "./MergeConfirmDialog";
import { ActionChoiceDialog } from "./ActionChoiceDialog";
import { MergeSuggestionsBanner } from "./MergeSuggestionsBanner";
import { TransferRulesDialog } from "./TransferRulesDialog";
import {
  useCategoriesWithSpend,
  useCategories,
  useSubordinateCategory,
  useUnsubordinateCategory,
} from "@/hooks/useCategories";
import type { CategoryWithSpend } from "@/types/models";

const P2P_NAMES = new Set(["venmo", "zelle", "cash app", "paypal", "apple cash"]);

interface CategoryNode {
  category: CategoryWithSpend;
  children: CategoryNode[];
}

function buildCategoryTree(
  categories: CategoryWithSpend[],
  search: string
): { tree: CategoryNode[]; standalone: CategoryNode[] } {
  const lowerSearch = search.toLowerCase();
  const filtered = search
    ? categories.filter((c) => c.name.toLowerCase().includes(lowerSearch))
    : categories;

  const filteredIds = new Set(filtered.map((c) => c.id));
  const catById = new Map(categories.map((c) => [c.id, c]));

  if (search) {
    for (const c of filtered) {
      if (c.parent_id && !filteredIds.has(c.parent_id)) {
        const parent = catById.get(c.parent_id);
        if (parent) filteredIds.add(parent.id);
      }
    }
  }

  const visible = categories.filter((c) => filteredIds.has(c.id));
  const childIds = new Set(
    visible.filter((c) => c.parent_id).map((c) => c.id)
  );
  const parentIds = new Set(
    visible.filter((c) => c.parent_id).map((c) => c.parent_id!)
  );

  const byParent = new Map<string, CategoryWithSpend[]>();
  for (const cat of visible) {
    if (cat.parent_id && filteredIds.has(cat.parent_id)) {
      const children = byParent.get(cat.parent_id) ?? [];
      children.push(cat);
      byParent.set(cat.parent_id, children);
    }
  }

  const tree: CategoryNode[] = [];
  const standalone: CategoryNode[] = [];

  for (const cat of visible) {
    if (childIds.has(cat.id)) continue;

    const children = (byParent.get(cat.id) ?? [])
      .sort((a, b) => b.total_spend - a.total_spend)
      .map((c) => ({ category: c, children: [] }));

    const node = { category: cat, children };

    if (parentIds.has(cat.id) || children.length > 0) {
      tree.push(node);
    } else {
      standalone.push(node);
    }
  }

  tree.sort(
    (a, b) =>
      b.children.reduce((s, c) => s + c.category.total_spend, 0) +
      b.category.total_spend -
      (a.children.reduce((s, c) => s + c.category.total_spend, 0) +
        a.category.total_spend)
  );
  standalone.sort((a, b) => b.category.total_spend - a.category.total_spend);

  return { tree, standalone };
}

function DraggableDroppableCard({
  category,
  selectedId,
  onTap,
}: {
  category: CategoryWithSpend;
  selectedId: string | null;
  onTap: (cat: CategoryWithSpend) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({
    id: category.id,
    data: category,
  });
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: category.id,
    data: category,
  });

  const setRef = useCallback(
    (node: HTMLDivElement | null) => {
      setDragRef(node);
      setDropRef(node);
    },
    [setDragRef, setDropRef]
  );

  return (
    <div
      onClick={() => onTap(category)}
      style={{ opacity: isDragging ? 0.4 : 1 }}
    >
      <CategoryCard
        ref={setRef}
        category={category}
        isSelected={selectedId === category.id}
        isDropTarget={isOver}
        listeners={listeners}
        attributes={attributes}
      />
    </div>
  );
}

function CategoryStack({
  node,
  selectedId,
  onTap,
  isDragging,
  expanded,
  onExpand,
  onCollapse,
  onUngroup,
}: {
  node: CategoryNode;
  selectedId: string | null;
  onTap: (cat: CategoryWithSpend) => void;
  isDragging: boolean;
  expanded: boolean;
  onExpand: () => void;
  onCollapse: () => void;
  onUngroup: (categoryId: string) => void;
}) {
  const childCount = node.children.length;
  const peekCount = Math.min(childCount, 2);

  return (
    <div
      className="relative"
      style={{ zIndex: expanded ? 40 : undefined }}
      onMouseEnter={() => {
        if (!isDragging) onExpand();
      }}
      onMouseLeave={onCollapse}
    >
      {/* Peek layers behind parent card */}
      {!expanded &&
        Array.from({ length: peekCount }, (_, i) => (
          <div
            key={i}
            className="absolute inset-0 rounded-lg border bg-card"
            style={{
              transform: `translate(${(i + 1) * 3}px, ${(i + 1) * 4}px)`,
              zIndex: peekCount - i,
            }}
          >
            <div
              className="absolute left-0 top-0 h-full w-1 rounded-l-lg"
              style={{
                backgroundColor:
                  node.children[i]?.category.color || "#6b7280",
              }}
            />
          </div>
        ))}

      {/* Parent card on top */}
      <div className="relative" style={{ zIndex: peekCount + 1 }}>
        <DraggableDroppableCard
          category={node.category}
          selectedId={selectedId}
          onTap={() => (expanded ? onCollapse() : onExpand())}
        />
        <div className="pointer-events-none absolute -right-1.5 -top-1.5 z-20 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground shadow-sm">
          +{childCount}
        </div>
      </div>

      {/* Expanded children panel */}
      {expanded && (
        <div className="absolute left-0 right-0 top-full z-50 pt-1">
          <div className="space-y-1 rounded-lg border bg-card p-2 shadow-lg">
            {node.children.map((child) => (
              <div key={child.category.id} className="flex items-center gap-1">
                <div className="flex-1 min-w-0">
                  <DraggableDroppableCard
                    category={child.category}
                    selectedId={selectedId}
                    onTap={onTap}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                  title="Ungroup"
                  onClick={(e) => {
                    e.stopPropagation();
                    onUngroup(child.category.id);
                  }}
                >
                  <Unlink className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function CategoryHierarchyBoard() {
  const { data: categories = [], isLoading } = useCategoriesWithSpend();
  const { data: plainCategories = [] } = useCategories();
  const subordinate = useSubordinateCategory();
  const unsubordinate = useUnsubordinateCategory();
  const [search, setSearch] = useState("");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expandedStackId, setExpandedStackId] = useState<string | null>(null);
  const [transferRulesCategory, setTransferRulesCategory] =
    useState<CategoryWithSpend | null>(null);

  const [pendingSource, setPendingSource] =
    useState<CategoryWithSpend | null>(null);
  const [pendingTarget, setPendingTarget] =
    useState<CategoryWithSpend | null>(null);

  const [mergeSource, setMergeSource] = useState<CategoryWithSpend | null>(
    null
  );
  const [mergeTarget, setMergeTarget] = useState<CategoryWithSpend | null>(
    null
  );

  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 8 },
  });
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: { delay: 200, tolerance: 5 },
  });
  const keyboardSensor = useSensor(KeyboardSensor);
  const sensors = useSensors(pointerSensor, touchSensor, keyboardSensor);

  const expenseCategories = useMemo(
    () => categories.filter((c) => !c.is_income),
    [categories]
  );

  const catById = useMemo(
    () => new Map(expenseCategories.map((c) => [c.id, c])),
    [expenseCategories]
  );

  const { tree, standalone } = useMemo(
    () => buildCategoryTree(expenseCategories, search),
    [expenseCategories, search]
  );

  const draggingCategory = draggingId ? catById.get(draggingId) : null;

  function canSubordinate(
    source: CategoryWithSpend,
    target: CategoryWithSpend
  ): { allowed: boolean; reason?: string } {
    if (target.parent_id !== null)
      return {
        allowed: false,
        reason: "Target is already a child (2-level max).",
      };
    const sourceHasChildren = expenseCategories.some(
      (c) => c.parent_id === source.id
    );
    if (sourceHasChildren)
      return {
        allowed: false,
        reason: "Source has children and cannot become a child itself.",
      };
    if (source.parent_id === target.id)
      return { allowed: false, reason: "Already a child of this category." };
    return { allowed: true };
  }

  function openActionChoice(
    source: CategoryWithSpend,
    target: CategoryWithSpend
  ) {
    setPendingSource(source);
    setPendingTarget(target);
  }

  function closeActionChoice() {
    setPendingSource(null);
    setPendingTarget(null);
  }

  function handleChooseMerge() {
    if (pendingSource && pendingTarget) {
      setMergeSource(pendingSource);
      setMergeTarget(pendingTarget);
    }
    closeActionChoice();
  }

  function handleChooseSubordinate() {
    if (pendingSource && pendingTarget) {
      subordinate.mutate({
        source_id: pendingSource.id,
        parent_id: pendingTarget.id,
      });
    }
    closeActionChoice();
  }

  function handleDragStart(event: DragStartEvent) {
    setDraggingId(String(event.active.id));
    setSelectedId(null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setDraggingId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const source = catById.get(String(active.id));
    const target = catById.get(String(over.id));
    if (source && target) {
      openActionChoice(source, target);
    }
  }

  function handleTap(cat: CategoryWithSpend) {
    if (draggingId) return;
    setExpandedStackId(null);

    if (!selectedId) {
      setSelectedId(cat.id);
      return;
    }

    if (selectedId === cat.id) {
      setSelectedId(null);
      return;
    }

    const source = catById.get(selectedId);
    if (source) {
      openActionChoice(source, cat);
    }
    setSelectedId(null);
  }

  function closeMergeDialog() {
    setMergeSource(null);
    setMergeTarget(null);
  }

  if (isLoading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  const subCheck =
    pendingSource && pendingTarget
      ? canSubordinate(pendingSource, pendingTarget)
      : { allowed: false, reason: "" };

  return (
    <div className="space-y-4">
      <MergeSuggestionsBanner categories={categories} />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Filter categories..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {selectedId && (
        <p className="text-sm text-blue-600 dark:text-blue-400">
          Tap another category to choose an action, or tap again to deselect.
        </p>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {tree.length > 0 && (
          <div className="rounded-lg border bg-card p-4">
            <h3 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Grouped
              <span className="ml-1.5 normal-case tracking-normal font-normal">
                ({tree.length})
              </span>
            </h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {tree.map((node) => (
                <CategoryStack
                  key={node.category.id}
                  node={node}
                  selectedId={selectedId}
                  onTap={handleTap}
                  isDragging={!!draggingId}
                  expanded={expandedStackId === node.category.id}
                  onExpand={() => setExpandedStackId(node.category.id)}
                  onCollapse={() => setExpandedStackId(null)}
                  onUngroup={(id) => unsubordinate.mutate(id)}
                />
              ))}
            </div>
          </div>
        )}

        {standalone.length > 0 && (
          <div className="rounded-lg border bg-card p-4">
            <h3 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Ungrouped
              <span className="ml-1.5 normal-case tracking-normal font-normal">
                ({standalone.length})
              </span>
            </h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {standalone.map((node) => {
                const isP2P = P2P_NAMES.has(node.category.name.toLowerCase());
                return (
                  <div key={node.category.id} className="relative">
                    <DraggableDroppableCard
                      category={node.category}
                      selectedId={selectedId}
                      onTap={handleTap}
                    />
                    {isP2P && (
                      <Button
                        variant="secondary"
                        size="icon"
                        className="absolute -right-1 -bottom-1 z-10 h-6 w-6 rounded-full shadow-sm"
                        title="Transfer rules"
                        onClick={(e) => {
                          e.stopPropagation();
                          setTransferRulesCategory(node.category);
                        }}
                      >
                        <ListFilter className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <DragOverlay>
          {draggingCategory && (
            <CategoryCard category={draggingCategory} isOverlay />
          )}
        </DragOverlay>
      </DndContext>

      {tree.length === 0 && standalone.length === 0 && (
        <p className="py-8 text-center text-muted-foreground">
          {search
            ? "No categories match your search."
            : "No expense categories found."}
        </p>
      )}

      <ActionChoiceDialog
        open={!!pendingSource && !!pendingTarget}
        onClose={closeActionChoice}
        source={pendingSource}
        target={pendingTarget}
        onMerge={handleChooseMerge}
        onSubordinate={handleChooseSubordinate}
        canSubordinate={subCheck.allowed}
        subordinateReason={subCheck.reason}
      />

      <MergeConfirmDialog
        open={!!mergeSource && !!mergeTarget}
        onClose={closeMergeDialog}
        source={mergeSource}
        target={mergeTarget}
      />

      {transferRulesCategory && (
        <TransferRulesDialog
          open
          onClose={() => setTransferRulesCategory(null)}
          sourceCategory={transferRulesCategory}
          allCategories={plainCategories}
        />
      )}
    </div>
  );
}
