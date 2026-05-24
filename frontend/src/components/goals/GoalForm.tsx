import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateGoal } from "@/hooks/useGoals";
import { useAccounts } from "@/hooks/useAccounts";
import type { Goal } from "@/types/models";

interface GoalFormProps {
  goal?: Goal;
  open: boolean;
  onClose: () => void;
}

const GOAL_TYPES = [
  { value: "savings", label: "Savings" },
  { value: "debt_payoff", label: "Debt Payoff" },
  { value: "emergency_fund", label: "Emergency Fund" },
  { value: "custom", label: "Custom" },
];

const PRESET_COLORS = [
  "#22C55E",
  "#3B82F6",
  "#8B5CF6",
  "#EF4444",
  "#F59E0B",
  "#EC4899",
  "#14B8A6",
  "#6366F1",
];

const ACCOUNT_TYPE_FILTER: Record<string, string[]> = {
  debt_payoff: ["loan", "credit"],
  savings: ["savings", "checking"],
  emergency_fund: ["savings", "checking"],
};

export function GoalForm({ goal, open, onClose }: GoalFormProps) {
  const [name, setName] = useState(goal?.name ?? "");
  const [goalType, setGoalType] = useState(goal?.goal_type ?? "savings");
  const [targetAmount, setTargetAmount] = useState(
    goal?.target_amount?.toString() ?? ""
  );
  const [currentAmount, setCurrentAmount] = useState(
    goal?.current_amount?.toString() ?? "0"
  );
  const [color, setColor] = useState(goal?.color ?? PRESET_COLORS[0]);
  const [targetDate, setTargetDate] = useState(goal?.target_date ?? "");
  const [linkedAccountId, setLinkedAccountId] = useState(
    goal?.linked_account_id ?? ""
  );

  const createGoal = useCreateGoal();
  const { data: accounts } = useAccounts();

  const allowedTypes = ACCOUNT_TYPE_FILTER[goalType];
  const filteredAccounts = accounts?.filter((a) =>
    allowedTypes ? allowedTypes.includes(a.account_type) : true
  );

  useEffect(() => {
    if (linkedAccountId && goalType === "debt_payoff" && accounts) {
      const acct = accounts.find((a) => a.id === linkedAccountId);
      if (acct) {
        setTargetAmount(Math.abs(acct.current_balance).toString());
      }
    }
  }, [linkedAccountId, goalType, accounts]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createGoal.mutate(
      {
        name,
        goal_type: goalType,
        target_amount: parseFloat(targetAmount),
        current_amount: parseFloat(currentAmount) || 0,
        color,
        target_date: targetDate || undefined,
        linked_account_id: linkedAccountId || undefined,
      },
      { onSuccess: onClose }
    );
  };

  const isDebtGoal = goalType === "debt_payoff";

  return (
    <Dialog open={open}>
      <DialogContent onClose={onClose}>
        <DialogHeader>
          <DialogTitle>{goal ? "Edit Goal" : "Create Goal"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="goal-name">Name</Label>
            <Input
              id="goal-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={isDebtGoal ? "Pay off mortgage" : "Emergency Fund"}
              required
            />
          </div>

          <div>
            <Label htmlFor="goal-type">Type</Label>
            <select
              id="goal-type"
              value={goalType}
              onChange={(e) => {
                setGoalType(e.target.value);
                setLinkedAccountId("");
              }}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {GOAL_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {filteredAccounts && filteredAccounts.length > 0 && (
            <div>
              <Label htmlFor="linked-account">Link to Account (optional)</Label>
              <select
                id="linked-account"
                value={linkedAccountId}
                onChange={(e) => setLinkedAccountId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">None</option>
                {filteredAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.account_type})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="target-amount">
                {isDebtGoal ? "Payoff Amount" : "Target Amount"}
              </Label>
              <Input
                id="target-amount"
                type="number"
                step="0.01"
                min="0"
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                placeholder="10000"
                required
              />
            </div>
            <div>
              <Label htmlFor="current-amount">
                {isDebtGoal ? "Already Paid" : "Starting Amount"}
              </Label>
              <Input
                id="current-amount"
                type="number"
                step="0.01"
                min="0"
                value={currentAmount}
                onChange={(e) => setCurrentAmount(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="target-date">Target Date (optional)</Label>
            <Input
              id="target-date"
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
            />
          </div>

          <div>
            <Label>Color</Label>
            <div className="mt-1 flex gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`h-8 w-8 rounded-full border-2 transition-transform ${
                    color === c
                      ? "scale-110 border-foreground"
                      : "border-transparent"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={createGoal.isPending}>
              {createGoal.isPending ? "Creating..." : "Create Goal"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
