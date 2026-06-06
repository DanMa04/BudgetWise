import { useState } from "react";
import { FileUp } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ImportFlow } from "@/components/import/ImportFlow";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called when the user clicks "Continue setup" after a successful import. */
  onContinueAfterImport?: () => void;
}

export function InlineImportDialog({
  open,
  onClose,
  onContinueAfterImport,
}: Props) {
  const [importedCount, setImportedCount] = useState<number | null>(null);
  const queryClient = useQueryClient();

  if (!open) return null;

  function handleComplete(importedRows: number) {
    setImportedCount(importedRows);
    // Refresh onboarding state so the wizard's Continue button knows we
    // have data now.
    queryClient.invalidateQueries({ queryKey: ["onboarding-state"] });
  }

  function handleContinue() {
    onClose();
    setImportedCount(null);
    onContinueAfterImport?.();
  }

  // Base Dialog portals to document.body for us — no manual portal needed.
  return (
    <Dialog open={open}>
      <DialogContent
        onClose={onClose}
        className="top-[5vh] translate-y-0 max-h-[90vh] w-[min(95vw,1000px)] max-w-[1000px] overflow-y-auto z-[60]"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileUp className="h-5 w-5 text-amber-500" />
            Import transactions
          </DialogTitle>
        </DialogHeader>

        <ImportFlow
          compact
          onComplete={(job) => handleComplete(job.imported_rows)}
          onCancel={onClose}
        />

        {importedCount !== null && (
          <div className="mt-4 flex justify-end">
            <Button onClick={handleContinue}>Continue setup</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
