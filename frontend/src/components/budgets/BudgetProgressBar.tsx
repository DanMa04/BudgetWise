import { cn } from "@/lib/utils";

interface BudgetProgressBarProps {
  percentage: number;
  className?: string;
}

function getProgressColor(percentage: number): string {
  if (percentage >= 100) return "bg-red-500";
  if (percentage >= 80) return "bg-yellow-500";
  return "bg-green-500";
}

export function BudgetProgressBar({
  percentage,
  className,
}: BudgetProgressBarProps) {
  const clampedPercentage = Math.min(percentage, 100);

  return (
    <div
      className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}
      role="progressbar"
      aria-valuenow={percentage}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn("h-full rounded-full transition-all", getProgressColor(percentage))}
        style={{ width: `${clampedPercentage}%` }}
      />
    </div>
  );
}
