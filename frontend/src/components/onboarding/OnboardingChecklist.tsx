import { CheckCircle2, Circle, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  useDismissOnboarding,
  useOnboardingState,
} from "@/hooks/useOnboarding";
import {
  STEP_LABELS,
  STEP_ORDER,
  nextTaskLabel,
  percentComplete,
  shouldShowBanner,
} from "@/components/onboarding/derive";

interface Props {
  onResume?: () => void;
}

export function OnboardingChecklist({ onResume }: Props) {
  const { data: state } = useOnboardingState();
  const dismiss = useDismissOnboarding();

  if (!shouldShowBanner(state)) return null;

  const percent = percentComplete(state!);
  const nextLabel = nextTaskLabel(state!);

  return (
    <div
      data-testid="onboarding-checklist"
      className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 dark:border-indigo-800 dark:bg-indigo-950/50"
      role="status"
    >
      <div className="flex items-start gap-3">
        <Sparkles className="h-5 w-5 shrink-0 text-indigo-600 dark:text-indigo-400" />
        <div className="flex-1 space-y-3">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-100">
              Finish setting up Kallio
            </p>
            <p className="text-xs text-indigo-700/80 dark:text-indigo-300/80">
              {percent}% complete — next: {nextLabel}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {STEP_ORDER.map((key) => {
              const done = state!.steps[key]?.done ?? false;
              const Icon = done ? CheckCircle2 : Circle;
              return (
                <span
                  key={key}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs",
                    done
                      ? "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200"
                      : "border-indigo-200 bg-white text-indigo-700 dark:border-indigo-700 dark:bg-indigo-950 dark:text-indigo-200"
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {STEP_LABELS[key]}
                </span>
              );
            })}
          </div>

          {onResume && (
            <div>
              <Button
                size="sm"
                onClick={onResume}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                Resume setup
              </Button>
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-auto shrink-0 p-1 hover:bg-transparent"
          onClick={() => dismiss.mutate()}
          aria-label="Dismiss onboarding checklist"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
