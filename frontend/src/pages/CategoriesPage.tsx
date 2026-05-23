import { useState } from "react";
import { Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CategoryHierarchyBoard } from "@/components/categories/CategoryHierarchyBoard";
import { AddCategoryDialog } from "@/components/categories/AddCategoryDialog";
import { useCategories, useCategoriesWithSpend, useResetGroups } from "@/hooks/useCategories";

export function CategoriesPage() {
  const [showAdd, setShowAdd] = useState(false);
  const { data: categories = [] } = useCategories();
  const { data: categoriesWithSpend = [] } = useCategoriesWithSpend();
  const resetGroups = useResetGroups();

  const hasGroups = categoriesWithSpend.some((c) => c.parent_id !== null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Categories</h1>
          <p className="text-sm text-muted-foreground">
            Drag categories onto each other to merge or organize into groups. Tap
            to select on mobile.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasGroups && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => resetGroups.mutate()}
              disabled={resetGroups.isPending}
            >
              <RotateCcw className="mr-1.5 h-4 w-4" />
              {resetGroups.isPending ? "Resetting..." : "Reset Groups"}
            </Button>
          )}
          <Button onClick={() => setShowAdd(true)} size="sm">
            <Plus className="mr-1.5 h-4 w-4" />
            Add
          </Button>
        </div>
      </div>

      <CategoryHierarchyBoard />

      <AddCategoryDialog
        open={showAdd}
        onClose={() => setShowAdd(false)}
        categories={categories}
      />
    </div>
  );
}
