import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, ListChecks, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AiCategorizationDialog } from "@/components/categories/AiCategorizationDialog";
import type { OnboardingState } from "@/types/models";

interface Props {
  state: OnboardingState;
  onContinue: () => void;
  onBack: () => void;
  onSkip: () => void;
  onCloseWizard: () => void;
}

export function CategorizeStep({
  state,
  onContinue,
  onBack,
  onSkip,
  onCloseWizard,
}: Props) {
  const navigate = useNavigate();
  const [showAi, setShowAi] = useState(false);

  const uncategorized = state.derived?.uncategorized_count ?? 0;
  const total = state.derived?.transaction_count ?? 0;
  const allCategorized = total > 0 && uncategorized === 0;

  function handleManualNav() {
    onCloseWizard();
    navigate("/transactions");
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-semibold">Organize your transactions</h3>
        <p className="text-sm text-muted-foreground">
          Sort spending into categories so reports and budgets make sense.
        </p>
      </div>

      <div
        className={
          allCategorized
            ? "flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
            : "flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
        }
      >
        <CheckCircle2 className="h-4 w-4" />
        <span>
          {allCategorized
            ? `All ${total} transactions categorized.`
            : `${uncategorized} of ${total} still need a category.`}
        </span>
      </div>

      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setShowAi(true)}
          className="flex w-full items-center gap-3 rounded-lg border p-4 text-left transition-colors hover:bg-accent"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-400">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="font-medium">Use AI Category Organizer</div>
            <div className="text-xs text-muted-foreground">
              Let Claude propose categories and assign transactions.
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={handleManualNav}
          className="flex w-full items-center gap-3 rounded-lg border p-4 text-left transition-colors hover:bg-accent"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
            <ListChecks className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="font-medium">Categorize manually</div>
            <div className="text-xs text-muted-foreground">
              Open the Transactions page and assign one by one.
            </div>
          </div>
        </button>
      </div>

      <div className="flex justify-between">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onSkip}>
            Skip for now
          </Button>
          <Button onClick={onContinue}>Continue</Button>
        </div>
      </div>

      <AiCategorizationDialog open={showAi} onClose={() => setShowAi(false)} />
    </div>
  );
}
