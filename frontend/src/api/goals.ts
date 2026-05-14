import { apiFetch } from "@/api/client";
import type {
  Goal,
  GoalWithProgress,
  GoalSummary,
  GoalContribution,
  CreateGoalData,
  CreateContributionData,
} from "@/types/models";

export async function getGoals(
  token: string,
  activeOnly: boolean = true
): Promise<Goal[]> {
  return apiFetch<Goal[]>(
    `/api/v1/goals/?active_only=${activeOnly}`,
    {},
    token
  );
}

export async function getGoal(
  goalId: string,
  token: string
): Promise<GoalWithProgress> {
  return apiFetch<GoalWithProgress>(`/api/v1/goals/${goalId}`, {}, token);
}

export async function getGoalSummary(token: string): Promise<GoalSummary> {
  return apiFetch<GoalSummary>("/api/v1/goals/summary", {}, token);
}

export async function createGoal(
  data: CreateGoalData,
  token: string
): Promise<Goal> {
  return apiFetch<Goal>(
    "/api/v1/goals/",
    { method: "POST", body: JSON.stringify(data) },
    token
  );
}

export async function updateGoal(
  goalId: string,
  data: Partial<CreateGoalData>,
  token: string
): Promise<Goal> {
  return apiFetch<Goal>(
    `/api/v1/goals/${goalId}`,
    { method: "PATCH", body: JSON.stringify(data) },
    token
  );
}

export async function deleteGoal(
  goalId: string,
  token: string
): Promise<void> {
  await apiFetch<void>(
    `/api/v1/goals/${goalId}`,
    { method: "DELETE" },
    token
  );
}

export async function addContribution(
  goalId: string,
  data: CreateContributionData,
  token: string
): Promise<GoalContribution> {
  return apiFetch<GoalContribution>(
    `/api/v1/goals/${goalId}/contributions`,
    { method: "POST", body: JSON.stringify(data) },
    token
  );
}

export async function getContributions(
  goalId: string,
  token: string
): Promise<GoalContribution[]> {
  return apiFetch<GoalContribution[]>(
    `/api/v1/goals/${goalId}/contributions`,
    {},
    token
  );
}
