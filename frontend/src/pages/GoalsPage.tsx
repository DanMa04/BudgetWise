import { useState } from "react";
import { Button } from "@/components/ui/button";
import { GoalSummaryCards } from "@/components/goals/GoalSummaryCards";
import { GoalCard } from "@/components/goals/GoalCard";
import { GoalForm } from "@/components/goals/GoalForm";
import { GoalDetail } from "@/components/goals/GoalDetail";
import { DebtStrategyComparison } from "@/components/goals/DebtStrategyComparison";
import { useGoals } from "@/hooks/useGoals";
import type { Goal, GoalWithProgress } from "@/types/models";

export function GoalsPage() {
  const { data: goals, isLoading } = useGoals();
  const [showForm, setShowForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);

  function openCreate() {
    setEditingGoal(null);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingGoal(null);
  }

  function startEdit(goal: Goal) {
    setSelectedGoalId(null);
    setEditingGoal(goal);
    setShowForm(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Goals</h1>
          <p className="text-muted-foreground">
            Track your savings, debt payoff, and investment goals.
          </p>
        </div>
        <Button onClick={openCreate}>Create Goal</Button>
      </div>

      <GoalSummaryCards />

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : goals && goals.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {goals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal as GoalWithProgress}
              onClick={() => setSelectedGoalId(goal.id)}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-12">
          <p className="text-lg font-medium text-muted-foreground">
            No goals yet
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Create your first savings goal to get started!
          </p>
          <Button className="mt-4" onClick={openCreate}>
            Create Goal
          </Button>
        </div>
      )}

      <DebtStrategyComparison />

      <GoalForm
        open={showForm}
        onClose={closeForm}
        goal={editingGoal ?? undefined}
      />

      {selectedGoalId && (
        <GoalDetail
          goalId={selectedGoalId}
          open={!!selectedGoalId}
          onClose={() => setSelectedGoalId(null)}
          onEdit={() => {
            const goal = goals?.find((g) => g.id === selectedGoalId);
            if (goal) startEdit(goal);
          }}
        />
      )}
    </div>
  );
}
