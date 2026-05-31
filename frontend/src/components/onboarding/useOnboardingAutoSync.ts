import { useEffect, useRef } from "react";
import {
  useOnboardingState,
  useUpdateOnboardingState,
} from "@/hooks/useOnboarding";
import type {
  OnboardingPatch,
  OnboardingStepKey,
} from "@/types/models";

/**
 * Watches derived counts from /onboarding/state and marks steps `done` when
 * thresholds are crossed (e.g. account_count > 0 → accounts_linked.done).
 *
 * This lets the wizard / banner stay accurate even when the user completes
 * a step outside the wizard (linking a bank from /accounts, importing from
 * /import, etc.).
 */
export function useOnboardingAutoSync() {
  const { data: state } = useOnboardingState();
  const update = useUpdateOnboardingState();
  const inflightRef = useRef(false);

  useEffect(() => {
    if (!state?.derived) return;
    if (inflightRef.current) return;

    const d = state.derived;
    const steps = state.steps;
    const patches: Partial<
      Record<OnboardingStepKey, Record<string, unknown>>
    > = {};

    if (!steps.accounts_linked?.done && d.account_count > 0) {
      patches.accounts_linked = { done: true };
    }
    if (!steps.transactions_imported?.done && d.transaction_count > 0) {
      patches.transactions_imported = {
        done: true,
        count: d.transaction_count,
      };
    }
    if (
      !steps.transactions_categorized?.done &&
      d.transaction_count > 0 &&
      d.uncategorized_count === 0
    ) {
      patches.transactions_categorized = { done: true };
    }
    if (!steps.goals_created?.done && d.goal_count > 0) {
      patches.goals_created = { done: true, count: d.goal_count };
    }
    if (!steps.budget_created?.done && d.active_budget_count > 0) {
      patches.budget_created = { done: true };
    }

    if (Object.keys(patches).length === 0) return;

    inflightRef.current = true;
    const payload: OnboardingPatch = { steps: patches };
    update.mutate(payload, {
      onSettled: () => {
        inflightRef.current = false;
      },
    });
  }, [state, update]);
}
