interface GoalMilestonesProps {
  milestones_reached: number[];
  percentage: number;
}

const MILESTONES = [25, 50, 75, 100];

export function GoalMilestones({
  milestones_reached,
  percentage,
}: GoalMilestonesProps) {
  return (
    <div className="relative w-full">
      <div className="h-2 w-full rounded-full bg-muted">
        <div
          className="h-2 rounded-full bg-primary transition-all duration-500"
          style={{ width: `${Math.min(100, percentage)}%` }}
        />
      </div>
      <div className="relative mt-1 flex justify-between">
        {MILESTONES.map((m) => {
          const reached = milestones_reached.includes(m);
          return (
            <div key={m} className="flex flex-col items-center">
              <div
                className={`h-3 w-3 rounded-full border-2 ${
                  reached
                    ? "border-primary bg-primary"
                    : "border-muted-foreground bg-background"
                }`}
              />
              <span className="mt-1 text-xs text-muted-foreground">{m}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
