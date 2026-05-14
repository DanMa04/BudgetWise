import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CategoryPicker } from "@/components/categories/CategoryPicker";
import { useBulkCategorize } from "@/hooks/useCategorization";
import { useCategories } from "@/hooks/useCategories";

interface BulkCategorizeProps {
  selectedIds: string[];
  onComplete: () => void;
}

export function BulkCategorize({
  selectedIds,
  onComplete,
}: BulkCategorizeProps) {
  const [categoryId, setCategoryId] = useState("");
  const { data: categories = [] } = useCategories();
  const bulkCategorize = useBulkCategorize();

  function handleCategorize() {
    if (!categoryId || selectedIds.length === 0) return;
    bulkCategorize.mutate(
      { transactionIds: selectedIds, categoryId },
      { onSuccess: onComplete }
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border bg-muted/50 px-4 py-2">
      <span className="text-sm font-medium">
        {selectedIds.length} selected
      </span>
      <CategoryPicker
        categories={categories}
        value={categoryId}
        onChange={setCategoryId}
        placeholder="Assign category"
        className="w-48"
      />
      <Button
        size="sm"
        onClick={handleCategorize}
        disabled={!categoryId || bulkCategorize.isPending}
      >
        {bulkCategorize.isPending ? "Categorizing..." : "Categorize"}
      </Button>
    </div>
  );
}
