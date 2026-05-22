import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CategoryHierarchyBoard } from "@/components/categories/CategoryHierarchyBoard";
import { AddCategoryDialog } from "@/components/categories/AddCategoryDialog";
import { useCategories } from "@/hooks/useCategories";

export function CategoriesPage() {
  const [showAdd, setShowAdd] = useState(false);
  const { data: categories = [] } = useCategories();

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
        <Button onClick={() => setShowAdd(true)} size="sm">
          <Plus className="mr-1.5 h-4 w-4" />
          Add
        </Button>
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
