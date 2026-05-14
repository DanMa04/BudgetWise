import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GoalProgressRing } from "@/components/goals/GoalProgressRing";
import { GoalMilestones } from "@/components/goals/GoalMilestones";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { useGoal, useAddContribution, useContributions } from "@/hooks/useGoals";

interface GoalDetailProps {
  goalId: string;
  open: boolean;
  onClose: () => void;
}

export function GoalDetail({ goalId, open, onClose }: GoalDetailProps) {
  const { data: goal, isLoading } = useGoal(goalId);
  const { data: contributions } = useContributions(goalId);
  const addContribution = useAddContribution();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const handleAddContribution = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount) return;
    addContribution.mutate(
      { goalId, data: { amount: parseFloat(amount), note: note || undefined } },
      {
        onSuccess: () => {
          setAmount("");
          setNote("");
        },
      }
    );
  };

  if (!open) return null;

  return (
    <Dialog open={open}>
      <DialogContent onClose={onClose} className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{goal?.name ?? "Goal Details"}</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : goal ? (
          <div className="space-y-6">
            <div className="flex items-center gap-6">
              <GoalProgressRing
                percentage={goal.percentage}
                size={120}
                strokeWidth={8}
                color={goal.color || undefined}
              />
              <div className="flex-1 space-y-2">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-muted-foreground">Current</p>
                    <p className="font-semibold">
                      {formatCurrency(goal.current_amount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Target</p>
                    <p className="font-semibold">
                      {formatCurrency(goal.target_amount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Monthly Rate</p>
                    <p className="font-semibold">
                      {formatCurrency(goal.monthly_rate)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Projected</p>
                    <p className="font-semibold">
                      {goal.projected_completion ?? "N/A"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <GoalMilestones
              milestones_reached={goal.milestones_reached}
              percentage={goal.percentage}
            />

            <div className="border-t pt-4">
              <h3 className="mb-3 text-sm font-semibold">Add Contribution</h3>
              <form
                onSubmit={handleAddContribution}
                className="flex items-end gap-2"
              >
                <div className="flex-1">
                  <Label htmlFor="contrib-amount" className="sr-only">
                    Amount
                  </Label>
                  <Input
                    id="contrib-amount"
                    type="number"
                    step="0.01"
                    placeholder="Amount"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                  />
                </div>
                <div className="flex-1">
                  <Label htmlFor="contrib-note" className="sr-only">
                    Note
                  </Label>
                  <Input
                    id="contrib-note"
                    placeholder="Note (optional)"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </div>
                <Button type="submit" disabled={addContribution.isPending}>
                  {addContribution.isPending ? "Adding..." : "Add"}
                </Button>
              </form>
            </div>

            {contributions && contributions.length > 0 && (
              <div className="border-t pt-4">
                <h3 className="mb-3 text-sm font-semibold">
                  Contribution History
                </h3>
                <div className="max-h-48 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-2 font-medium">Date</th>
                        <th className="pb-2 font-medium">Amount</th>
                        <th className="pb-2 font-medium">Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contributions.map((c) => (
                        <tr key={c.id} className="border-b last:border-0">
                          <td className="py-2">
                            {formatDate(c.contributed_at)}
                          </td>
                          <td
                            className={`py-2 font-medium ${
                              c.amount >= 0 ? "text-green-600" : "text-red-500"
                            }`}
                          >
                            {c.amount >= 0 ? "+" : ""}
                            {formatCurrency(Math.abs(c.amount))}
                          </td>
                          <td className="py-2 text-muted-foreground">
                            {c.note ?? "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
