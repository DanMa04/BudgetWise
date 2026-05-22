import { useState } from "react";
import { Repeat, Check, X, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CategoryPicker } from "@/components/categories/CategoryPicker";
import {
  useSubscriptionSuggestions,
  useApplySubscription,
} from "@/hooks/useCategorization";
import { useCategories } from "@/hooks/useCategories";
import { useDismissedSet } from "@/hooks/useDismissedSet";
import { formatCurrency } from "@/lib/formatters";
import type { SubscriptionSuggestion } from "@/types/models";

const PERIOD_LABELS: Record<string, string> = {
  weekly: "Weekly",
  biweekly: "Bi-weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  annual: "Annual",
};

function SuggestionRow({
  suggestion,
  onApply,
  onDismiss,
  applying,
}: {
  suggestion: SubscriptionSuggestion;
  onApply: (suggestion: SubscriptionSuggestion, categoryId: string) => void;
  onDismiss: (merchant: string) => void;
  applying: boolean;
}) {
  const { data: categories = [] } = useCategories();
  const [expanded, setExpanded] = useState(false);
  const [categoryId, setCategoryId] = useState(
    suggestion.subscription_category_id ?? ""
  );

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100">
            <Repeat className="h-5 w-5 text-indigo-600" />
          </div>
          <div className="min-w-0">
            <p className="font-medium truncate">{suggestion.merchant}</p>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className="text-sm font-semibold text-red-500">
                {formatCurrency(suggestion.amount)}
              </span>
              <Badge
                variant="outline"
                className="text-xs"
              >
                {PERIOD_LABELS[suggestion.period] ?? suggestion.period}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {suggestion.occurrence_count} charges
              </span>
            </div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(!expanded)}
          className="shrink-0"
        >
          {expanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </Button>
      </div>

      {expanded && (
        <div className="mt-4 space-y-3 pl-[52px]">
          <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
            <div>
              <span className="font-medium text-foreground">First seen:</span>{" "}
              {new Date(suggestion.first_seen).toLocaleDateString()}
            </div>
            <div>
              <span className="font-medium text-foreground">Last seen:</span>{" "}
              {new Date(suggestion.last_seen).toLocaleDateString()}
            </div>
            <div>
              <span className="font-medium text-foreground">Next expected:</span>{" "}
              {new Date(suggestion.next_expected).toLocaleDateString()}
            </div>
            <div>
              <span className="font-medium text-foreground">Avg interval:</span>{" "}
              {Math.round(suggestion.avg_interval_days)} days
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-sm font-medium" id={`cat-label-${suggestion.merchant}`}>Categorize as:</span>
            <CategoryPicker
              categories={categories}
              value={categoryId}
              onChange={setCategoryId}
              placeholder="Select category"
            />
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={!categoryId || applying}
              onClick={() => onApply(suggestion, categoryId)}
            >
              <Check className="mr-1 h-4 w-4" />
              {applying ? "Applying..." : `Apply to ${suggestion.occurrence_count} transactions`}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDismiss(suggestion.merchant)}
            >
              <X className="mr-1 h-4 w-4" />
              Dismiss
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function SubscriptionSuggestions() {
  const { data: suggestions = [], isLoading } = useSubscriptionSuggestions();
  const applyMutation = useApplySubscription();
  const { dismissed, dismiss } = useDismissedSet("budgetwise:dismissed-subscription-suggestions");

  const visible = suggestions.filter((s) => !dismissed.has(s.merchant));

  function handleApply(suggestion: SubscriptionSuggestion, categoryId: string) {
    applyMutation.mutate({
      transaction_ids: suggestion.transaction_ids,
      category_id: categoryId,
      merchant_pattern: suggestion.merchant,
      create_rule: true,
    });
  }

  if (isLoading || visible.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Repeat className="h-5 w-5 text-indigo-600" />
          Recurring Charges Detected
          <Badge variant="secondary" className="ml-auto">
            {visible.length}
          </Badge>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          We detected these recurring charges. Would you like to categorize them
          as subscriptions?
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {visible.map((suggestion) => (
          <SuggestionRow
            key={`${suggestion.merchant}-${suggestion.amount}`}
            suggestion={suggestion}
            onApply={handleApply}
            onDismiss={dismiss}
            applying={applyMutation.isPending}
          />
        ))}
      </CardContent>
    </Card>
  );
}
