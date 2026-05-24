import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { CategoryPicker } from "./CategoryPicker";
import { useDeleteCategory } from "@/hooks/useCategories";
import type { Category, CategoryWithSpend } from "@/types/models";

interface DeleteCategoryDialogProps {
  open: boolean;
  onClose: () => void;
  category: CategoryWithSpend | null;
  allCategories: Category[];
}

export function DeleteCategoryDialog({
  open,
  onClose,
  category,
  allCategories,
}: DeleteCategoryDialogProps) {
  const deleteMutation = useDeleteCategory();
  const [action, setAction] = useState<"reassign" | "delete">("reassign");
  const [reassignTo, setReassignTo] = useState("");

  if (!category) return null;

  const hasTransactions = category.transaction_count > 0;
  const availableCategories = allCategories.filter(
    (c) => c.id !== category.id,
  );

  function handleClose() {
    setAction("reassign");
    setReassignTo("");
    onClose();
  }

  function handleDelete() {
    const params: {
      id: string;
      reassign_to?: string;
      delete_transactions?: boolean;
    } = { id: category!.id };

    if (hasTransactions) {
      if (action === "reassign" && reassignTo) {
        params.reassign_to = reassignTo;
      } else if (action === "delete") {
        params.delete_transactions = true;
      } else {
        return;
      }
    }

    deleteMutation.mutate(params, { onSuccess: handleClose });
  }

  const canConfirm =
    !hasTransactions ||
    action === "delete" ||
    (action === "reassign" && !!reassignTo);

  return (
    <Dialog open={open}>
      <DialogContent onClose={handleClose} className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Delete Category
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-lg border p-3">
            <div
              className="h-4 w-4 shrink-0 rounded-full"
              style={{ backgroundColor: category.color || "#6b7280" }}
            />
            <div>
              <p className="text-sm font-medium">{category.name}</p>
              <p className="text-xs text-muted-foreground">
                {category.transaction_count} transaction
                {category.transaction_count !== 1 && "s"}
              </p>
            </div>
          </div>

          {!hasTransactions ? (
            <p className="text-sm text-muted-foreground">
              This category has no transactions. Any budgets linked to it will
              also be removed.
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                This category has{" "}
                <span className="font-medium text-foreground">
                  {category.transaction_count}
                </span>{" "}
                transaction{category.transaction_count !== 1 && "s"}. Choose
                what to do with them:
              </p>

              <div className="space-y-3">
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                  <input
                    type="radio"
                    name="delete-action"
                    value="reassign"
                    checked={action === "reassign"}
                    onChange={() => setAction("reassign")}
                    className="mt-0.5"
                  />
                  <div className="flex-1 space-y-2">
                    <span className="text-sm font-medium">
                      Move transactions to another category
                    </span>
                    {action === "reassign" && (
                      <CategoryPicker
                        categories={availableCategories}
                        value={reassignTo}
                        onChange={setReassignTo}
                        placeholder="Select a category..."
                      />
                    )}
                  </div>
                </label>

                <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors has-[:checked]:border-destructive has-[:checked]:bg-destructive/5">
                  <input
                    type="radio"
                    name="delete-action"
                    value="delete"
                    checked={action === "delete"}
                    onChange={() => setAction("delete")}
                    className="mt-0.5"
                  />
                  <div>
                    <span className="text-sm font-medium">
                      Delete all transactions
                    </span>
                    <p className="text-xs text-muted-foreground">
                      This will permanently remove all{" "}
                      {category.transaction_count} transaction
                      {category.transaction_count !== 1 && "s"}.
                    </p>
                  </div>
                </label>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={deleteMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!canConfirm || deleteMutation.isPending}
          >
            {deleteMutation.isPending ? "Deleting..." : "Delete Category"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
