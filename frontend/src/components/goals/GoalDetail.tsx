import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { GoalProgressRing } from "@/components/goals/GoalProgressRing";
import { GoalMilestones } from "@/components/goals/GoalMilestones";
import { AmortizationChart } from "@/components/charts/AmortizationChart";
import { InvestmentGrowthChart } from "@/components/charts/InvestmentGrowthChart";
import { formatCurrency, formatDate } from "@/lib/formatters";
import {
  useGoal,
  useAddContribution,
  useContributions,
  useUpdateGoal,
  useDeleteGoal,
} from "@/hooks/useGoals";
import {
  useDebtProjection,
  useInvestmentProjection,
} from "@/hooks/useProjections";
import { useAccounts } from "@/hooks/useAccounts";

interface GoalDetailProps {
  goalId: string;
  open: boolean;
  onClose: () => void;
}

export function GoalDetail({ goalId, open, onClose }: GoalDetailProps) {
  const { data: goal, isLoading } = useGoal(goalId);
  const { data: contributions } = useContributions(goalId);
  const { data: accounts } = useAccounts();
  const addContribution = useAddContribution();
  const updateGoal = useUpdateGoal();
  const deleteGoal = useDeleteGoal();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [extraPayment, setExtraPayment] = useState<number | null>(null);

  const linkedAccount = goal?.linked_account_id
    ? accounts?.find((a) => a.id === goal.linked_account_id)
    : null;
  const isDebtLinked =
    linkedAccount?.account_type === "loan" ||
    linkedAccount?.account_type === "credit";
  const isInvestmentLinked = linkedAccount?.account_type === "investment";

  const minPayment = Number(linkedAccount?.minimum_payment ?? 0);

  useEffect(() => {
    if (goal && isDebtLinked && extraPayment === null) {
      const planned = goal.planned_monthly_contribution
        ? Number(goal.planned_monthly_contribution)
        : 0;
      setExtraPayment(Math.max(0, planned - minPayment));
    }
  }, [goal, isDebtLinked, minPayment, extraPayment]);

  const currentExtra = extraPayment ?? 0;

  const savedExtraRef = useRef<number>(0);
  useEffect(() => {
    if (goal && isDebtLinked) {
      const planned = goal.planned_monthly_contribution
        ? Number(goal.planned_monthly_contribution)
        : 0;
      savedExtraRef.current = Math.max(0, planned - minPayment);
    }
  }, [goal, isDebtLinked, minPayment]);

  function handleClose() {
    if (isDebtLinked && currentExtra !== savedExtraRef.current) {
      const newPlanned = minPayment + currentExtra;
      updateGoal.mutate({
        id: goalId,
        data: { planned_monthly_contribution: newPlanned },
      });
    }
    setExtraPayment(null);
    onClose();
  }

  const handleAddContribution = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount) return;
    addContribution.mutate(
      {
        goalId,
        data: { amount: parseFloat(amount), note: note || undefined },
      },
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
      <DialogContent
        onClose={handleClose}
        className={
          linkedAccount
            ? "max-w-2xl max-h-[90vh] overflow-y-auto"
            : "max-w-xl"
        }
      >
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

            {isDebtLinked && linkedAccount && (
              <DebtProjectionSection
                accountId={linkedAccount.id}
                extraPayment={currentExtra}
                onExtraPaymentChange={setExtraPayment}
              />
            )}

            {isInvestmentLinked && linkedAccount && (
              <InvestmentProjectionSection
                accountId={linkedAccount.id}
                monthlyContribution={goal.monthly_rate}
              />
            )}

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

            <div className="border-t pt-4">
              {confirmDelete ? (
                <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950">
                  <p className="text-sm text-red-600">Delete this goal?</p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setConfirmDelete(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={deleteGoal.isPending}
                      onClick={() =>
                        deleteGoal.mutate(goalId, { onSuccess: handleClose })
                      }
                    >
                      {deleteGoal.isPending ? "Deleting..." : "Delete"}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                  onClick={() => setConfirmDelete(true)}
                >
                  Delete Goal
                </Button>
              )}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function DebtProjectionSection({
  accountId,
  extraPayment,
  onExtraPaymentChange,
}: {
  accountId: string;
  extraPayment: number;
  onExtraPaymentChange: (v: number) => void;
}) {
  const { data, isLoading, isError } = useDebtProjection(
    accountId,
    extraPayment
  );

  return (
    <div className="border-t pt-4 space-y-3">
      <h3 className="text-sm font-semibold">Payoff Projection</h3>
      <div className="space-y-1.5">
        <Label htmlFor="extra-payment">Extra Monthly Payment</Label>
        <div className="relative w-40">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            $
          </span>
          <Input
            id="extra-payment"
            type="number"
            min={0}
            step={50}
            value={extraPayment || ""}
            onChange={(e) =>
              onExtraPaymentChange(
                e.target.value ? parseFloat(e.target.value) : 0
              )
            }
            className="pl-6"
            placeholder="0"
          />
        </div>
      </div>
      {isLoading ? (
        <Spinner className="h-6 w-6" />
      ) : isError ? (
        <p className="text-sm text-muted-foreground">
          Unable to load projection.
        </p>
      ) : data ? (
        <AmortizationChart
          scheduleMinOnly={data.schedule_min_only}
          scheduleWithExtra={data.schedule_with_extra}
          monthsSaved={data.months_saved}
          interestSaved={data.interest_saved}
        />
      ) : null}
    </div>
  );
}

function InvestmentProjectionSection({
  accountId,
  monthlyContribution,
}: {
  accountId: string;
  monthlyContribution: number;
}) {
  const { data, isLoading, isError } = useInvestmentProjection(
    accountId,
    monthlyContribution
  );

  return (
    <div className="border-t pt-4 space-y-3">
      <h3 className="text-sm font-semibold">Growth Projection</h3>
      <p className="text-xs text-muted-foreground">
        Based on {formatCurrency(monthlyContribution)}/mo contribution
      </p>
      {isLoading ? (
        <Spinner className="h-6 w-6" />
      ) : isError ? (
        <p className="text-sm text-muted-foreground">
          Unable to load projection.
        </p>
      ) : data ? (
        <InvestmentGrowthChart
          projection={data.projection}
          balance5y={data.balance_5y}
          balance10y={data.balance_10y}
          balance20y={data.balance_20y}
          balance30y={data.balance_30y}
        />
      ) : null}
    </div>
  );
}
