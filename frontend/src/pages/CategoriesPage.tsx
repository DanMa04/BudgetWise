import { CategoryHierarchyBoard } from "@/components/categories/CategoryHierarchyBoard";

export function CategoriesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Categories</h1>
        <p className="text-sm text-muted-foreground">
          Drag categories onto each other to merge or organize into groups. Tap
          to select on mobile.
        </p>
      </div>

      <CategoryHierarchyBoard />
    </div>
  );
}
