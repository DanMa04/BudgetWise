import { useState } from "react";
import { AlertCircle, AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBudgetSummary } from "@/hooks/useBudgets";
import { cn } from "@/lib/utils";
import type { BudgetWithSpend } from "@/types/models";

interface AlertItem {
  id: string;
  budget: BudgetWithSpend;
  level: "warning" | "exceeded";
}

export function AlertBanner() {
  const { data: summary } = useBudgetSummary();
  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    try {
      const stored = sessionStorage.getItem("kallio_dismissed_alerts");
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  if (!summary) return null;

  const alerts: AlertItem[] = summary.budgets
    .filter((b) => b.percentage_used >= 80)
    .map((b) => ({
      id: b.id,
      budget: b,
      level: b.percentage_used > 100 ? "exceeded" : "warning",
    }))
    .filter((a) => !dismissed.has(a.id));

  if (alerts.length === 0) return null;

  function dismiss(id: string) {
    setDismissed((prev) => {
      const next = new Set(prev).add(id);
      try {
        sessionStorage.setItem("kallio_dismissed_alerts", JSON.stringify([...next]));
      } catch {
        // sessionStorage may be unavailable (e.g. private browsing); ignore.
      }
      return next;
    });
  }

  return (
    <div className="space-y-2" data-testid="alert-banner">
      {alerts.map((alert) => {
        const isExceeded = alert.level === "exceeded";
        const Icon = isExceeded ? AlertCircle : AlertTriangle;
        const percentage = Math.round(alert.budget.percentage_used);

        return (
          <div
            key={alert.id}
            className={cn(
              "flex items-center gap-3 rounded-lg border px-4 py-3",
              isExceeded
                ? "border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
                : "border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-200"
            )}
            role="alert"
          >
            <Icon className="h-4 w-4 shrink-0" />
            <p className="flex-1 text-sm">
              <span className="font-semibold">{alert.budget.name}</span>
              {isExceeded
                ? ` is over budget at ${percentage}%`
                : ` has reached ${percentage}% of its budget`}
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-1 hover:bg-transparent"
              onClick={() => dismiss(alert.id)}
              aria-label={`Dismiss ${alert.budget.name} alert`}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        );
      })}
    </div>
  );
}
