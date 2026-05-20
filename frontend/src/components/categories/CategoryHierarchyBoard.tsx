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
import { Search, ChevronRight, CornerDownRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { CategoryCard } from "./CategoryCard";
import { MergeConfirmDialog } from "./MergeConfirmDialog";
import { ActionChoiceDialog } from "./ActionChoiceDialog";
import { MergeSuggestionsBanner } from "./MergeSuggestionsBanner";
import {
  useCategoriesWithSpend,
  useSubordinateCategory,
  useUnsubordinateCategory,
} from "@/hooks/useCategories";
import type { CategoryWithSpend } from "@/types/models";

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

  // When searching, also include parents of matched children
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
  indent,
}: {
  category: CategoryWithSpend;
  selectedId: string | null;
  onTap: (cat: CategoryWithSpend) => void;
  indent?: boolean;
}) {
  const canDrag = !category.is_system;
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({
    id: category.id,
    disabled: !canDrag,
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
      className={indent ? "flex items-center gap-1" : ""}
    >
      {indent && (
        <CornerDownRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      )}
      <div className={indent ? "flex-1" : ""}>
        <CategoryCard
          ref={setRef}
          category={category}
          isSelected={selectedId === category.id}
          isDropTarget={isOver}
          listeners={canDrag ? listeners : undefined}
          attributes={canDrag ? attributes : undefined}
        />
      </div>
    </div>
  );
}

export function CategoryHierarchyBoard() {
  const { data: categories = [], isLoading } = useCategoriesWithSpend();
  const subordinate = useSubordinateCategory();
  const unsubordinate = useUnsubordinateCategory();
  const [search, setSearch] = useState("");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // Action choice dialog state
  const [pendingSource, setPendingSource] =
    useState<CategoryWithSpend | null>(null);
  const [pendingTarget, setPendingTarget] =
    useState<CategoryWithSpend | null>(null);

  // Merge confirm dialog state
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
    if (source.is_system)
      return { allowed: false, reason: "System categories cannot become children." };
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
    if (source && target && !source.is_system) {
      openActionChoice(source, target);
    }
  }

  function handleTap(cat: CategoryWithSpend) {
    if (draggingId) return;

    if (!selectedId) {
      if (!cat.is_system) {
        setSelectedId(cat.id);
      }
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

  function toggleCollapse(parentId: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(parentId)) {
        next.delete(parentId);
      } else {
        next.add(parentId);
      }
      return next;
    });
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
        <div className="space-y-4">
          {/* Parent groups */}
          {tree.map((node) => (
            <div key={node.category.id} className="space-y-1">
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => toggleCollapse(node.category.id)}
                >
                  <ChevronRight
                    className={`h-4 w-4 transition-transform ${
                      !collapsed.has(node.category.id) ? "rotate-90" : ""
                    }`}
                  />
                </Button>
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {node.category.name}
                  <span className="ml-1 normal-case tracking-normal">
                    ({node.children.length} sub)
                  </span>
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                <DraggableDroppableCard
                  category={node.category}
                  selectedId={selectedId}
                  onTap={handleTap}
                />
                {!collapsed.has(node.category.id) &&
                  node.children.map((child) => (
                    <DraggableDroppableCard
                      key={child.category.id}
                      category={child.category}
                      selectedId={selectedId}
                      onTap={handleTap}
                      indent
                    />
                  ))}
              </div>
            </div>
          ))}

          {/* Standalone categories */}
          {standalone.length > 0 && (
            <div className="space-y-1">
              {tree.length > 0 && (
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Ungrouped
                </span>
              )}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {standalone.map((node) => (
                  <DraggableDroppableCard
                    key={node.category.id}
                    category={node.category}
                    selectedId={selectedId}
                    onTap={handleTap}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

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
    </div>
  );
}
