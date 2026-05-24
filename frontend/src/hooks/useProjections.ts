import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/clerk-react";
import {
  getDebtProjection,
  getMultiDebtStrategy,
  getInvestmentProjection,
} from "@/api/projections";

export function useDebtProjection(
  accountId: string | null,
  extraPayment: number
) {
  const { getToken } = useAuth();

  return useQuery({
    queryKey: ["debt-projection", accountId, extraPayment],
    queryFn: async () => {
      const token = await getToken();
      if (!token || !accountId) throw new Error("Not authenticated");
      return getDebtProjection(accountId, extraPayment, token);
    },
    enabled: !!accountId,
  });
}

export function useMultiDebtStrategy(totalBudget: number | null) {
  const { getToken } = useAuth();

  return useQuery({
    queryKey: ["multi-debt-strategy", totalBudget],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return getMultiDebtStrategy(totalBudget, token);
    },
  });
}

export function useInvestmentProjection(
  accountId: string | null,
  monthlyContribution: number | null
) {
  const { getToken } = useAuth();

  return useQuery({
    queryKey: ["investment-projection", accountId, monthlyContribution],
    queryFn: async () => {
      const token = await getToken();
      if (!token || !accountId) throw new Error("Not authenticated");
      return getInvestmentProjection(accountId, monthlyContribution, token);
    },
    enabled: !!accountId,
  });
}
