import { useState } from "react";
import { ArrowRight, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MergeConfirmDialog } from "./MergeConfirmDialog";
import { useMergeSuggestions } from "@/hooks/useCategories";
import { useDismissedSet } from "@/hooks/useDismissedSet";
import type { Category, CategoryWithSpend } from "@/types/models";

function toCardData(cat: Category): CategoryWithSpend {
  return { ...cat, total_spend: 0, transaction_count: 0 };
}

interface MergeSuggestionsBannerProps {
  categories?: CategoryWithSpend[];
}

export function MergeSuggestionsBanner({
  categories,
}: MergeSuggestionsBannerProps) {
  const { data: suggestions = [] } = useMergeSuggestions();
  const { dismissed, dismiss } = useDismissedSet("budgetwise:dismissed-merge-suggestions");
  const [mergeSource, setMergeSource] = useState<CategoryWithSpend | null>(
    null
  );
  const [mergeTarget, setMergeTarget] = useState<CategoryWithSpend | null>(
    null
  );

  const visible = suggestions.filter(
    (s) => !dismissed.has(`${s.source.id}-${s.target.id}`)
  );

  if (visible.length === 0) return null;

  const catMap = categories
    ? new Map(categories.map((c) => [c.id, c]))
    : null;

  function openMerge(source: Category, target: Category) {
    setMergeSource(catMap?.get(source.id) ?? toCardData(source));
    setMergeTarget(catMap?.get(target.id) ?? toCardData(target));
  }

  function closeMerge() {
    if (mergeSource && mergeTarget) {
      dismiss(`${mergeSource.id}-${mergeTarget.id}`);
    }
    setMergeSource(null);
    setMergeTarget(null);
  }

  return (
    <>
      <div className="rounded-lg border bg-muted/50 p-3">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium">
          <Sparkles className="h-4 w-4 text-amber-500" />
          Merge Suggestions
        </div>

        <div className="space-y-2">
          {visible.map((s) => {
            const key = `${s.source.id}-${s.target.id}`;
            return (
              <div
                key={key}
                className="flex items-center gap-2 rounded-md bg-background px-3 py-2 text-sm"
              >
                <div className="flex min-w-0 flex-1 items-center gap-1.5">
                  <div
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{
                      backgroundColor: s.source.color || "#6b7280",
                    }}
                  />
                  <span className="truncate font-medium">
                    {s.source.name}
                  </span>

                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />

                  <div
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{
                      backgroundColor: s.target.color || "#6b7280",
                    }}
                  />
                  <span className="truncate font-medium">
                    {s.target.name}
                  </span>

                  <span className="shrink-0 text-xs text-muted-foreground">
                    {Math.round(s.similarity_score * 100)}%
                  </span>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs"
                    onClick={() => openMerge(s.source, s.target)}
                  >
                    Merge
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    onClick={() => dismiss(key)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <MergeConfirmDialog
        open={!!mergeSource && !!mergeTarget}
        onClose={closeMerge}
        source={mergeSource}
        target={mergeTarget}
      />
    </>
  );
}
