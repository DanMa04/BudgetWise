import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CategoryPicker } from "@/components/categories/CategoryPicker";
import { useCorrectTransaction } from "@/hooks/useCategorization";
import { useCategories } from "@/hooks/useCategories";
import type { Transaction } from "@/types/models";

interface CategoryCorrectionProps {
  transaction: Transaction;
  onClose: () => void;
}

export function CategoryCorrection({
  transaction,
  onClose,
}: CategoryCorrectionProps) {
  const [categoryId, setCategoryId] = useState(
    transaction.category_id ?? ""
  );
  const [createRule, setCreateRule] = useState(false);
  const { data: categories = [] } = useCategories();
  const correctTransaction = useCorrectTransaction();

  const selectedCategory = categories.find((c) => c.id === categoryId);

  function handleConfirm() {
    if (!categoryId) return;
    correctTransaction.mutate(
      {
        transactionId: transaction.id,
        categoryId,
        createRuleFlag: createRule,
      },
      { onSuccess: onClose }
    );
  }

  return (
    <div className="absolute z-50 mt-1 w-72 rounded-lg border bg-background p-3 shadow-lg">
      <div className="space-y-3">
        <CategoryPicker
          categories={categories}
          value={categoryId}
          onChange={setCategoryId}
          placeholder="Select category"
        />

        {categoryId && categoryId !== transaction.category_id && (
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={createRule}
              onChange={(e) => setCreateRule(e.target.checked)}
              className="mt-0.5 rounded border-input"
            />
            <span className="text-muted-foreground">
              Always categorize &ldquo;{transaction.description}&rdquo; as{" "}
              {selectedCategory?.name ?? "this category"}?
            </span>
          </label>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleConfirm}
            disabled={!categoryId || correctTransaction.isPending}
          >
            {correctTransaction.isPending ? "Saving..." : "Apply"}
          </Button>
        </div>
      </div>
    </div>
  );
}
