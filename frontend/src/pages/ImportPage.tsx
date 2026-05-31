import { useState } from "react";
import { Monitor } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ImportFlow } from "@/components/import/ImportFlow";
import { ImportHistory } from "@/components/import/ImportHistory";
import { MergeSuggestionsBanner } from "@/components/categories/MergeSuggestionsBanner";
import { useDeleteImport, useImportHistory } from "@/hooks/useImport";

function MobileRestriction() {
  return (
    <Card className="md:hidden">
      <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
        <Monitor className="h-12 w-12 text-muted-foreground" />
        <div>
          <p className="font-medium">Import is available on desktop</p>
          <p className="text-sm text-muted-foreground mt-1">
            Please use a larger screen to import files.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export function ImportPage() {
  const { data: importHistory = [], isLoading: historyLoading } =
    useImportHistory();
  const deleteMutation = useDeleteImport();
  const [showMergeBanner, setShowMergeBanner] = useState(false);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Import Transactions</h1>
        <p className="text-muted-foreground">
          Import transactions from CSV or Excel files.
        </p>
      </div>

      <MobileRestriction />

      <div className="hidden md:block space-y-6">
        <ImportFlow onComplete={() => setShowMergeBanner(true)} />
        {showMergeBanner && <MergeSuggestionsBanner />}
      </div>

      <ImportHistory
        imports={importHistory}
        loading={historyLoading}
        onDelete={(jobId) => deleteMutation.mutate(jobId)}
        deleting={deleteMutation.isPending}
      />
    </div>
  );
}
