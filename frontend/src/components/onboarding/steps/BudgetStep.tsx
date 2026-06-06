import { useState } from "react";
import { CheckCircle2, PieChart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ZeroBudgetDialog } from "@/components/budgets/ZeroBudgetDialog";
import type { OnboardingState } from "@/types/models";

interface Props {
  state: OnboardingState;
  onContinue: () => void;
  onBack: () => void;
  onSkip: () => void;
}

export function BudgetStep({ state, onContinue, onBack, onSkip }: Props) {
  const [showDialog, setShowDialog] = useState(false);
  const hasBudget = (state.derived?.active_budget_count ?? 0) > 0;

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-semibold">Build your budget</h3>
        <p className="text-sm text-muted-foreground">
          Allocate your income across spending categories and goal
          contributions.
        </p>
      </div>

      {hasBudget ? (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
          <CheckCircle2 className="h-4 w-4" />
          <span>Budget is active.</span>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-lg border border-muted bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          <PieChart className="h-4 w-4" />
          <span>No active budget yet.</span>
        </div>
      )}

      <Button onClick={() => setShowDialog(true)} className="w-full">
        <PieChart className="mr-2 h-4 w-4" />
        Open Budget
      </Button>

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

      <ZeroBudgetDialog open={showDialog} onClose={() => setShowDialog(false)} />
    </div>
  );
}
