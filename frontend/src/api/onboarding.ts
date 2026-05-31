import { apiFetch } from "@/api/client";
import type { OnboardingPatch, OnboardingState } from "@/types/models";

export async function getOnboardingState(token: string): Promise<OnboardingState> {
  return apiFetch<OnboardingState>("/api/v1/onboarding/state", {}, token);
}

export async function patchOnboardingState(
  patch: OnboardingPatch,
  token: string
): Promise<OnboardingState> {
  return apiFetch<OnboardingState>(
    "/api/v1/onboarding/state",
    {
      method: "PATCH",
      body: JSON.stringify(patch),
    },
    token
  );
}

export async function dismissOnboarding(token: string): Promise<OnboardingState> {
  return apiFetch<OnboardingState>(
    "/api/v1/onboarding/dismiss",
    { method: "POST" },
    token
  );
}

export async function resetOnboarding(token: string): Promise<OnboardingState> {
  return apiFetch<OnboardingState>(
    "/api/v1/onboarding/reset",
    { method: "POST" },
    token
  );
}
