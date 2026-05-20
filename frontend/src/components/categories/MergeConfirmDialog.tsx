import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/formatters";
import { useMergeCategories } from "@/hooks/useCategories";
import type { CategoryWithSpend } from "@/types/models";

interface MergeConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  source: CategoryWithSpend | null;
  target: CategoryWithSpend | null;
}

export function MergeConfirmDialog({
  open,
  onClose,
  source,
  target,
}: MergeConfirmDialogProps) {
  const merge = useMergeCategories();

  if (!source || !target) return null;

  function handleMerge() {
    merge.mutate(
      { source_id: source!.id, target_id: target!.id },
      { onSuccess: onClose }
    );
  }

  return (
    <Dialog open={open}>
      <DialogContent onClose={onClose} className="max-w-md">
        <DialogHeader>
          <DialogTitle>Merge Categories</DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-center gap-4 py-4">
          <div className="flex flex-col items-center gap-1 rounded-lg border p-3">
            <div
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: source.color || "#6b7280" }}
            />
            <span className="text-sm font-medium">{source.name}</span>
            <span className="text-xs text-muted-foreground">
              {formatCurrency(source.total_spend)}
            </span>
          </div>

          <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground" />

          <div className="flex flex-col items-center gap-1 rounded-lg border-2 border-primary p-3">
            <div
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: target.color || "#6b7280" }}
            />
            <span className="text-sm font-medium">{target.name}</span>
            <span className="text-xs text-muted-foreground">
              {formatCurrency(target.total_spend)}
            </span>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          All transactions, rules, and budgets from{" "}
          <span className="font-medium text-foreground">{source.name}</span>{" "}
          will be moved to{" "}
          <span className="font-medium text-foreground">{target.name}</span>.{" "}
          <span className="font-medium text-foreground">{source.name}</span>{" "}
          will be permanently deleted.
        </p>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={merge.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleMerge}
            disabled={merge.isPending}
          >
            {merge.isPending ? "Merging..." : "Merge"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
