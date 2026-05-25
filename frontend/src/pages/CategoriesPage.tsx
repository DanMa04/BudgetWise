import { useState } from "react";
import { Plus, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CategoryHierarchyBoard } from "@/components/categories/CategoryHierarchyBoard";
import { AddCategoryDialog } from "@/components/categories/AddCategoryDialog";
import { SnapshotManager } from "@/components/categories/SnapshotManager";
import { AiCategorizationDialog } from "@/components/categories/AiCategorizationDialog";
import { useCategories, useCategoriesWithSpend, useResetGroups } from "@/hooks/useCategories";

export function CategoriesPage() {
  const [showAdd, setShowAdd] = useState(false);
  const [showAi, setShowAi] = useState(false);
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
          <Button
            variant="outline"
            size="sm"
            className="ai-rainbow"
            onClick={() => setShowAi(true)}
          >
            <Sparkles className="mr-1.5 h-4 w-4 text-violet-500" />
            AI Organize
          </Button>
          <SnapshotManager />
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

      <AiCategorizationDialog
        open={showAi}
        onClose={() => setShowAi(false)}
      />
    </div>
  );
}
