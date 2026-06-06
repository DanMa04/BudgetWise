import type {
  OnboardingState,
  OnboardingStepKey,
} from "@/types/models";

export const STEP_ORDER: OnboardingStepKey[] = [
  "accounts_linked",
  "transactions_imported",
  "transactions_categorized",
  "goals_created",
  "budget_created",
];

export const STEP_LABELS: Record<OnboardingStepKey, string> = {
  accounts_linked: "Connect accounts",
  transactions_imported: "Import transactions",
  transactions_categorized: "Categorize transactions",
  goals_created: "Set goals",
  budget_created: "Build a budget",
};

export const STEP_DESCRIPTIONS: Record<OnboardingStepKey, string> = {
  accounts_linked: "Link a bank or import a file so we have something to work with.",
  transactions_imported: "Pull in your transactions to see your real activity.",
  transactions_categorized: "Sort recent activity into categories you understand.",
  goals_created: "Tell us what you're saving for so we can track progress.",
  budget_created: "Plan how your income is allocated each month.",
};

export function currentStep(state: OnboardingState): OnboardingStepKey | null {
  return state.derived?.next_step ?? null;
}

export function percentComplete(state: OnboardingState): number {
  if (state.derived) return state.derived.percent_complete;
  const done = STEP_ORDER.filter((k) => state.steps[k]?.done).length;
  return Math.round((done / STEP_ORDER.length) * 100);
}

export function isOnboardingComplete(state: OnboardingState): boolean {
  return STEP_ORDER.every((k) => state.steps[k]?.done);
}

export function shouldShowBanner(state: OnboardingState | undefined): boolean {
  if (!state) return false;
  if (state.wizard_dismissed) return false;
  return !isOnboardingComplete(state);
}

export function nextTaskLabel(state: OnboardingState): string {
  const step = currentStep(state);
  return step ? STEP_LABELS[step] : "Review setup";
}
