import { apiFetch } from "@/api/client";
import type {
  Budget,
  BudgetSummary,
  BudgetWithSpend,
  CreateBudgetData,
} from "@/types/models";

export async function getBudgets(token: string): Promise<BudgetWithSpend[]> {
  return apiFetch<BudgetWithSpend[]>("/api/v1/budgets", {}, token);
}

export async function createBudget(
  data: CreateBudgetData,
  token: string
): Promise<Budget> {
  return apiFetch<Budget>(
    "/api/v1/budgets",
    {
      method: "POST",
      body: JSON.stringify(data),
    },
    token
  );
}

export async function getBudgetSummary(
  token: string
): Promise<BudgetSummary> {
  return apiFetch<BudgetSummary>("/api/v1/budgets/summary", {}, token);
}

export async function updateBudget(
  id: string,
  data: Partial<CreateBudgetData>,
  token: string
): Promise<Budget> {
  return apiFetch<Budget>(
    `/api/v1/budgets/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify(data),
    },
    token
  );
}

export async function deleteBudget(id: string, token: string): Promise<void> {
  await apiFetch<void>(`/api/v1/budgets/${id}`, { method: "DELETE" }, token);
}
