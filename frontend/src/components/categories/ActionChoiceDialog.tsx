import { ArrowRight, GitMerge, FolderTree } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import type { CategoryWithSpend } from "@/types/models";

interface ActionChoiceDialogProps {
  open: boolean;
  onClose: () => void;
  source: CategoryWithSpend | null;
  target: CategoryWithSpend | null;
  onMerge: () => void;
  onSubordinate: () => void;
  canSubordinate: boolean;
  subordinateReason?: string;
}

export function ActionChoiceDialog({
  open,
  onClose,
  source,
  target,
  onMerge,
  onSubordinate,
  canSubordinate,
  subordinateReason,
}: ActionChoiceDialogProps) {
  if (!source || !target) return null;

  return (
    <Dialog open={open}>
      <DialogContent onClose={onClose} className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Choose Action</DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-center gap-3 py-3">
          <div className="flex items-center gap-1.5">
            <div
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: source.color || "#6b7280" }}
            />
            <span className="text-sm font-medium">{source.name}</span>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="flex items-center gap-1.5">
            <div
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: target.color || "#6b7280" }}
            />
            <span className="text-sm font-medium">{target.name}</span>
          </div>
        </div>

        <div className="space-y-2">
          <Button
            variant="destructive"
            className="w-full justify-start gap-2"
            onClick={onMerge}
          >
            <GitMerge className="h-4 w-4" />
            Merge into {target.name}
          </Button>
          <p className="px-1 text-xs text-muted-foreground">
            Moves all transactions, rules, and budgets. Deletes{" "}
            {source.name}.
          </p>

          <Button
            variant="outline"
            className="w-full justify-start gap-2"
            disabled={!canSubordinate}
            onClick={onSubordinate}
          >
            <FolderTree className="h-4 w-4" />
            Make child of {target.name}
          </Button>
          {!canSubordinate && subordinateReason && (
            <p className="px-1 text-xs text-muted-foreground">
              {subordinateReason}
            </p>
          )}
          {canSubordinate && (
            <p className="px-1 text-xs text-muted-foreground">
              Nests {source.name} under {target.name} as a subcategory.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
