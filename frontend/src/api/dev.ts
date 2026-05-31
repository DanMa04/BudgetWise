import { apiFetch } from "@/api/client";

export interface WipeResponse {
  wiped: Record<string, number>;
}

export interface ResetBudgetResponse {
  budgets_deleted: number;
  goals_zeroed: number;
}

export async function wipeAllData(token: string): Promise<WipeResponse> {
  return apiFetch<WipeResponse>(
    "/api/v1/dev/wipe-all",
    { method: "POST" },
    token
  );
}

export async function resetBudget(token: string): Promise<ResetBudgetResponse> {
  return apiFetch<ResetBudgetResponse>(
    "/api/v1/dev/reset-budget",
    { method: "POST" },
    token
  );
}
