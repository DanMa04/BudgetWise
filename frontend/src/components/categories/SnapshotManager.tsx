import { useState } from "react";
import { History, Save, Undo2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useSnapshots,
  useCreateSnapshot,
  useRestoreSnapshot,
  useDeleteSnapshot,
} from "@/hooks/useSnapshots";
import type { Snapshot } from "@/api/snapshots";

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

const TRIGGER_LABELS: Record<string, string> = {
  manual: "Manual save",
  pre_merge: "Before merge",
  pre_reset: "Before reset",
  pre_restore: "Before restore",
  pre_ai: "Before AI reorganize",
};

export function SnapshotManager() {
  const { data: snapshots = [] } = useSnapshots();
  const createSnapshot = useCreateSnapshot();
  const restoreSnapshot = useRestoreSnapshot();
  const deleteSnapshot = useDeleteSnapshot();
  const [open, setOpen] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState<Snapshot | null>(null);
  const [restoreResult, setRestoreResult] = useState<{
    categories_restored: number;
    transactions_updated: number;
  } | null>(null);

  function handleRestore(snapshot: Snapshot) {
    restoreSnapshot.mutate(snapshot.id, {
      onSuccess: (result) => {
        setConfirmRestore(null);
        setRestoreResult(result);
      },
    });
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
      >
        <History className="mr-1.5 h-4 w-4" />
        Save States
        {snapshots.length > 0 && (
          <span className="ml-1.5 rounded-full bg-muted px-1.5 text-[10px] font-medium">
            {snapshots.length}
          </span>
        )}
      </Button>

      <Dialog open={open && !confirmRestore}>
        <DialogContent onClose={() => setOpen(false)} className="max-w-md">
          <DialogHeader>
            <DialogTitle>Category Save States</DialogTitle>
          </DialogHeader>

          <p className="text-sm text-muted-foreground">
            Save states capture your categories, rules, and transaction
            assignments. Up to 3 are kept — oldest is removed automatically.
          </p>

          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => createSnapshot.mutate()}
            disabled={createSnapshot.isPending}
          >
            <Save className="mr-1.5 h-4 w-4" />
            {createSnapshot.isPending ? "Saving..." : "Save Current State"}
          </Button>

          {restoreResult && (
            <div className="rounded-md bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 px-3 py-2 text-sm text-green-700 dark:text-green-400">
              Restored {restoreResult.categories_restored} categories and updated{" "}
              {restoreResult.transactions_updated} transactions.
              <button
                className="ml-2 underline"
                onClick={() => setRestoreResult(null)}
              >
                dismiss
              </button>
            </div>
          )}

          {snapshots.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No save states yet. States are created automatically before merges
              and resets, or you can save manually.
            </p>
          ) : (
            <div className="space-y-2">
              {snapshots.map((snap) => (
                <div
                  key={snap.id}
                  className="flex items-center gap-2 rounded-lg border p-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium truncate">
                        {snap.name}
                      </span>
                      <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        {TRIGGER_LABELS[snap.trigger] || snap.trigger}
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {snap.category_count} categories · {snap.rule_count} rules
                      · {formatRelativeTime(snap.created_at)}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    title="Restore"
                    onClick={() => setConfirmRestore(snap)}
                  >
                    <Undo2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                    title="Delete"
                    onClick={() => deleteSnapshot.mutate(snap.id)}
                    disabled={deleteSnapshot.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Restore confirmation */}
      <Dialog open={!!confirmRestore}>
        <DialogContent
          onClose={() => setConfirmRestore(null)}
          className="max-w-sm"
        >
          <DialogHeader>
            <DialogTitle>Restore Save State?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will replace all your current categories, rules, and transaction
            assignments with the saved state from{" "}
            <strong>
              {confirmRestore && formatRelativeTime(confirmRestore.created_at)}
            </strong>
            . A safety snapshot of your current state will be created first.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmRestore(null)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => confirmRestore && handleRestore(confirmRestore)}
              disabled={restoreSnapshot.isPending}
            >
              {restoreSnapshot.isPending ? "Restoring..." : "Restore"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
