import { useState } from "react";
import { CheckCircle2, Plus, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GoalForm } from "@/components/goals/GoalForm";
import { useGoals } from "@/hooks/useGoals";
import type { OnboardingState } from "@/types/models";

interface Props {
  state: OnboardingState;
  onContinue: () => void;
  onBack: () => void;
  onSkip: () => void;
}

export function GoalsStep({ state, onContinue, onBack, onSkip }: Props) {
  const [showForm, setShowForm] = useState(false);
  const { data: goals = [] } = useGoals();
  const hasGoals = (state.derived?.goal_count ?? goals.length) > 0;

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-semibold">Set your goals</h3>
        <p className="text-sm text-muted-foreground">
          What are you saving toward? Emergency fund, debt payoff, a trip?
        </p>
      </div>

      {hasGoals ? (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
          <CheckCircle2 className="h-4 w-4" />
          <span>
            {goals.length} {goals.length === 1 ? "goal" : "goals"} set up.
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-lg border border-muted bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          <Target className="h-4 w-4" />
          <span>No goals yet.</span>
        </div>
      )}

      {goals.length > 0 && (
        <ul className="space-y-1.5 rounded-lg border p-2 max-h-40 overflow-y-auto">
          {goals.map((goal) => (
            <li key={goal.id} className="flex items-center gap-2 text-sm">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: goal.color || "#6366F1" }}
              />
              <span className="font-medium">{goal.name}</span>
              <span className="ml-auto text-xs text-muted-foreground">
                ${Number(goal.target_amount).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      )}

      <Button
        variant="outline"
        onClick={() => setShowForm(true)}
        className="w-full"
      >
        <Plus className="mr-2 h-4 w-4" />
        Add a goal
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

      <GoalForm open={showForm} onClose={() => setShowForm(false)} />
    </div>
  );
}
