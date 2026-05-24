import { apiFetch } from "@/api/client";
import type {
  DebtProjectionResponse,
  MultiDebtStrategyResponse,
  InvestmentProjectionResponse,
} from "@/types/models";

export async function getDebtProjection(
  accountId: string,
  extraPayment: number,
  token: string
): Promise<DebtProjectionResponse> {
  return apiFetch<DebtProjectionResponse>(
    `/api/v1/projections/debt/${accountId}`,
    {
      method: "POST",
      body: JSON.stringify({ extra_payment: extraPayment }),
    },
    token
  );
}

export async function getMultiDebtStrategy(
  totalBudget: number | null,
  token: string
): Promise<MultiDebtStrategyResponse> {
  return apiFetch<MultiDebtStrategyResponse>(
    "/api/v1/projections/debt/strategy",
    {
      method: "POST",
      body: JSON.stringify({ total_monthly_budget: totalBudget }),
    },
    token
  );
}

export async function getInvestmentProjection(
  accountId: string,
  monthlyContribution: number | null,
  token: string
): Promise<InvestmentProjectionResponse> {
  return apiFetch<InvestmentProjectionResponse>(
    `/api/v1/projections/investment/${accountId}`,
    {
      method: "POST",
      body: JSON.stringify({ monthly_contribution: monthlyContribution }),
    },
    token
  );
}
