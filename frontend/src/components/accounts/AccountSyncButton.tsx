import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useSyncItem, useSyncAll } from "@/hooks/usePlaid";
import type { SyncResponse } from "@/types/models";

interface AccountSyncButtonProps {
  itemId?: string;
}

export function AccountSyncButton({ itemId }: AccountSyncButtonProps) {
  const [result, setResult] = useState<string | null>(null);
  const syncItem = useSyncItem();
  const syncAllMutation = useSyncAll();

  const isPending = syncItem.isPending || syncAllMutation.isPending;

  function handleSync() {
    setResult(null);

    if (itemId) {
      syncItem.mutate(itemId, {
        onSuccess: (data: SyncResponse) => {
          setResult(
            `Synced: ${data.added} new, ${data.modified} updated, ${data.removed} removed`
          );
        },
      });
    } else {
      syncAllMutation.mutate(undefined, {
        onSuccess: (data: SyncResponse[]) => {
          const totals = data.reduce(
            (acc, r) => ({
              added: acc.added + r.added,
              modified: acc.modified + r.modified,
              removed: acc.removed + r.removed,
            }),
            { added: 0, modified: 0, removed: 0 }
          );
          setResult(
            `Synced: ${totals.added} new, ${totals.modified} updated, ${totals.removed} removed`
          );
        },
      });
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleSync}
        disabled={isPending}
      >
        {isPending && (
          <span className="mr-1 inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
        )}
        {itemId ? "Sync" : "Sync All"}
      </Button>
      {result && (
        <span className="text-xs text-muted-foreground">{result}</span>
      )}
    </div>
  );
}
