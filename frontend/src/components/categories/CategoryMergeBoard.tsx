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
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { CategoryCard } from "./CategoryCard";
import { MergeConfirmDialog } from "./MergeConfirmDialog";
import { MergeSuggestionsBanner } from "./MergeSuggestionsBanner";
import { useCategoriesWithSpend } from "@/hooks/useCategories";
import type { CategoryWithSpend } from "@/types/models";

function DraggableDroppableCard({
  category,
  selectedId,
  onTap,
}: {
  category: CategoryWithSpend;
  selectedId: string | null;
  onTap: (cat: CategoryWithSpend) => void;
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
      role="button"
      tabIndex={0}
      onClick={() => onTap(category)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onTap(category);
        }
      }}
      style={{ opacity: isDragging ? 0.4 : 1 }}
    >
      <CategoryCard
        ref={setRef}
        category={category}
        isSelected={selectedId === category.id}
        isDropTarget={isOver}
        listeners={canDrag ? listeners : undefined}
        attributes={canDrag ? attributes : undefined}
      />
    </div>
  );
}

export function CategoryMergeBoard() {
  const { data: categories = [], isLoading } = useCategoriesWithSpend();
  const [search, setSearch] = useState("");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
    () =>
      categories
        .filter(
          (c) =>
            !c.is_income &&
            c.name.toLowerCase().includes(search.toLowerCase())
        )
        .sort((a, b) => b.total_spend - a.total_spend),
    [categories, search]
  );

  const catById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );

  const draggingCategory = draggingId ? catById.get(draggingId) : null;

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
      setMergeSource(source);
      setMergeTarget(target);
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
      setMergeSource(source);
      setMergeTarget(cat);
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
          Tap another category to merge into it, or tap again to deselect.
        </p>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {expenseCategories.map((cat) => (
            <DraggableDroppableCard
              key={cat.id}
              category={cat}
              selectedId={selectedId}
              onTap={handleTap}
            />
          ))}
        </div>

        <DragOverlay>
          {draggingCategory && (
            <CategoryCard category={draggingCategory} isOverlay />
          )}
        </DragOverlay>
      </DndContext>

      {expenseCategories.length === 0 && (
        <p className="py-8 text-center text-muted-foreground">
          {search ? "No categories match your search." : "No expense categories found."}
        </p>
      )}

      <MergeConfirmDialog
        open={!!mergeSource && !!mergeTarget}
        onClose={closeMergeDialog}
        source={mergeSource}
        target={mergeTarget}
      />
    </div>
  );
}
