import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GoalProgressRing } from "@/components/goals/GoalProgressRing";
import { formatCurrency } from "@/lib/formatters";
import type { GoalWithProgress } from "@/types/models";

interface GoalCardProps {
  goal: GoalWithProgress;
  onClick?: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  savings: "Savings",
  debt_payoff: "Debt Payoff",
  emergency_fund: "Emergency Fund",
  custom: "Custom",
};

function getDaysRemaining(targetDate: string | null): string | null {
  if (!targetDate) return null;
  const target = new Date(targetDate + "T12:00:00");
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const diff = Math.ceil(
    (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diff < 0) return "Overdue";
  if (diff === 0) return "Due today";
  return `${diff} days left`;
}

export function GoalCard({ goal, onClick }: GoalCardProps) {
  const daysInfo = getDaysRemaining(goal.target_date);

  return (
    <Card
      className={onClick ? "cursor-pointer transition-shadow hover:shadow-md" : ""}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-semibold">{goal.name}</CardTitle>
        <Badge variant="secondary">
          {TYPE_LABELS[goal.goal_type] || goal.goal_type}
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <GoalProgressRing
            percentage={goal.percentage}
            size={80}
            strokeWidth={6}
            color={goal.color || undefined}
          />
          <div className="flex-1 space-y-1">
            <p className="text-sm font-medium">
              {formatCurrency(goal.current_amount)} of{" "}
              {formatCurrency(goal.target_amount)}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(goal.remaining_amount)} remaining
            </p>
            {daysInfo && (
              <p
                className={`text-xs ${
                  daysInfo === "Overdue"
                    ? "font-medium text-red-500"
                    : "text-muted-foreground"
                }`}
              >
                {daysInfo}
              </p>
            )}
            {goal.projected_completion && (
              <p className="text-xs text-muted-foreground">
                On track for {goal.projected_completion}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
