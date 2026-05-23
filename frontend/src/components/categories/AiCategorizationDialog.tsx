import { useState } from "react";
import { Sparkles, ChevronRight, FolderTree, Merge, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAnalyzeCategories, useApplyProposal } from "@/hooks/useAiCategorization";
import type { AnalyzeResult, ProposedCategory } from "@/api/aiCategorization";

type Step = "choose" | "analyzing" | "preview" | "applied";

export function AiCategorizationDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const analyze = useAnalyzeCategories();
  const apply = useApplyProposal();
  const [step, setStep] = useState<Step>("choose");
  const [mode, setMode] = useState<"subcategorize" | "merge">("subcategorize");
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [applyResult, setApplyResult] = useState<{
    categories_created: number;
    categories_updated: number;
    transactions_updated: number;
  } | null>(null);

  function handleClose() {
    setStep("choose");
    setResult(null);
    setApplyResult(null);
    onClose();
  }

  function handleAnalyze(selectedMode: "subcategorize" | "merge") {
    setMode(selectedMode);
    setStep("analyzing");
    analyze.mutate(selectedMode, {
      onSuccess: (data) => {
        setResult(data);
        setStep("preview");
      },
      onError: () => {
        setStep("choose");
      },
    });
  }

  function handleApply() {
    if (!result) return;
    apply.mutate(
      {
        proposed_categories: result.proposed_categories,
        assignments: result.assignments,
      },
      {
        onSuccess: (data) => {
          setApplyResult(data);
          setStep("applied");
        },
      }
    );
  }

  return (
    <Dialog open={open}>
      <DialogContent
        onClose={handleClose}
        className="max-h-[90vh] max-w-lg overflow-y-auto"
      >
        {step === "choose" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-violet-500" />
                AI Category Organizer
              </DialogTitle>
            </DialogHeader>

            <p className="text-sm text-muted-foreground">
              Let AI analyze your transactions and reorganize your categories.
              A save state is created automatically before any changes.
            </p>

            <div className="space-y-2">
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-lg border p-3 text-left hover:bg-muted/50 transition-colors"
                onClick={() => handleAnalyze("subcategorize")}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-950">
                  <FolderTree className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">Maximize Detail</div>
                  <div className="text-xs text-muted-foreground">
                    Create subcategories for granular spending visibility
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>

              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-lg border p-3 text-left hover:bg-muted/50 transition-colors"
                onClick={() => handleAnalyze("merge")}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-950">
                  <Merge className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">Simplify</div>
                  <div className="text-xs text-muted-foreground">
                    Consolidate into fewer, broader categories
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            </div>

            {analyze.isError && (
              <p className="text-sm text-destructive">
                {analyze.error.message}
              </p>
            )}
          </>
        )}

        {step === "analyzing" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-violet-500" />
                Analyzing Transactions...
              </DialogTitle>
            </DialogHeader>
            <div className="flex flex-col items-center gap-3 py-8">
              <Spinner className="h-8 w-8" />
              <p className="text-sm text-muted-foreground">
                {mode === "subcategorize"
                  ? "Finding patterns and creating subcategories..."
                  : "Identifying categories to consolidate..."}
              </p>
            </div>
          </>
        )}

        {step === "preview" && result && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-violet-500" />
                Proposed Changes
              </DialogTitle>
            </DialogHeader>

            <p className="text-sm text-muted-foreground">{result.summary}</p>

            <div className="grid grid-cols-2 gap-2">
              <StatCard
                label={mode === "subcategorize" ? "New subcategories" : "Categories after"}
                value={
                  mode === "subcategorize"
                    ? result.stats.new_subcategories
                    : result.proposed_categories.length
                }
              />
              <StatCard
                label={mode === "subcategorize" ? "New parents" : "Merged away"}
                value={
                  mode === "subcategorize"
                    ? result.stats.new_parent_categories
                    : result.stats.categories_merged_away
                }
              />
              <StatCard
                label="Kept as-is"
                value={result.stats.categories_kept}
              />
              <StatCard
                label="Txns reassigned"
                value={result.stats.transactions_assigned}
              />
            </div>

            <div className="max-h-60 overflow-y-auto space-y-1.5 rounded-lg border p-2">
              {result.proposed_categories
                .filter((c) => !c.is_income)
                .map((cat) => (
                  <CategoryPreviewRow key={cat.name} category={cat} />
                ))}
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setStep("choose");
                  setResult(null);
                }}
              >
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                Back
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={handleClose}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="flex-1"
                onClick={handleApply}
                disabled={apply.isPending}
              >
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                {apply.isPending ? "Applying..." : "Apply Changes"}
              </Button>
            </div>

            {apply.isError && (
              <p className="text-sm text-destructive">
                {apply.error.message}
              </p>
            )}
          </>
        )}

        {step === "applied" && applyResult && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-green-500" />
                Changes Applied
              </DialogTitle>
            </DialogHeader>

            <div className="rounded-md bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 px-3 py-2.5 text-sm text-green-700 dark:text-green-400">
              <ul className="space-y-0.5">
                <li>{applyResult.categories_created} categories created</li>
                <li>{applyResult.categories_updated} categories updated</li>
                {applyResult.categories_deleted > 0 && (
                  <li>{applyResult.categories_deleted} categories removed</li>
                )}
                <li>{applyResult.transactions_updated} transactions reassigned</li>
              </ul>
            </div>

            <p className="text-sm text-muted-foreground">
              A save state was created before applying. You can restore it from
              the Save States menu if needed.
            </p>

            <Button size="sm" onClick={handleClose} className="w-full">
              Done
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border px-3 py-2 text-center">
      <div className="text-lg font-bold tabular-nums">{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}

function CategoryPreviewRow({ category }: { category: ProposedCategory }) {
  const isNew = !category.existing_id;
  const hasMerged = (category.merged_from?.length ?? 0) > 0;

  return (
    <div>
      <div className="flex items-center gap-1.5">
        <span
          className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: category.color || "#6b7280" }}
        />
        <span className="text-sm font-medium truncate">{category.name}</span>
        {isNew && (
          <span className="shrink-0 rounded bg-blue-100 dark:bg-blue-950 px-1 py-0.5 text-[10px] font-medium text-blue-700 dark:text-blue-400">
            new
          </span>
        )}
        {hasMerged && (
          <span className="shrink-0 text-[10px] text-muted-foreground truncate">
            ← {category.merged_from!.join(", ")}
          </span>
        )}
      </div>
      {category.children.length > 0 && (
        <div className="ml-4 mt-0.5 space-y-0.5">
          {category.children.map((child) => (
            <div key={child.name} className="flex items-center gap-1.5">
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: child.color || "#6b7280" }}
              />
              <span className="text-xs text-muted-foreground truncate">
                {child.name}
              </span>
              {!child.existing_id && (
                <span className="shrink-0 rounded bg-blue-100 dark:bg-blue-950 px-1 py-0.5 text-[9px] font-medium text-blue-700 dark:text-blue-400">
                  new
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
