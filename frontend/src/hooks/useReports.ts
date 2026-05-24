import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/clerk-react";
import {
  fetchSpendingByCategory,
  fetchSpendingByCategoryOverTime,
  fetchSpendingTrends,
  fetchBudgetVsActual,
  fetchMonthlyComparison,
  fetchIncomeVsExpense,
  fetchTopMerchants,
  fetchCategoryVendors,
} from "@/api/reports";

export function useSpendingByCategory(startDate: string, endDate: string) {
  const { getToken } = useAuth();

  return useQuery({
    queryKey: ["spending-by-category", startDate, endDate],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return fetchSpendingByCategory(token, startDate, endDate);
    },
  });
}

export function useSpendingByCategoryOverTime(
  startDate: string,
  endDate: string,
  granularity: string,
  categoryIds?: string[],
) {
  const { getToken } = useAuth();

  return useQuery({
    queryKey: ["spending-by-category-over-time", startDate, endDate, granularity, categoryIds],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return fetchSpendingByCategoryOverTime(token, startDate, endDate, granularity, categoryIds);
    },
  });
}

export function useSpendingTrends(
  startDate: string,
  endDate: string,
  granularity: string
) {
  const { getToken } = useAuth();

  return useQuery({
    queryKey: ["spending-trends", startDate, endDate, granularity],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return fetchSpendingTrends(token, startDate, endDate, granularity);
    },
  });
}

export function useBudgetVsActual(startDate: string, endDate: string) {
  const { getToken } = useAuth();

  return useQuery({
    queryKey: ["budget-vs-actual", startDate, endDate],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return fetchBudgetVsActual(token, startDate, endDate);
    },
  });
}

export function useMonthlyComparison(months: number) {
  const { getToken } = useAuth();

  return useQuery({
    queryKey: ["monthly-comparison", months],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return fetchMonthlyComparison(token, months);
    },
  });
}

export function useIncomeVsExpense(
  startDate: string,
  endDate: string,
  granularity: string
) {
  const { getToken } = useAuth();

  return useQuery({
    queryKey: ["income-vs-expense", startDate, endDate, granularity],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return fetchIncomeVsExpense(token, startDate, endDate, granularity);
    },
  });
}

export function useTopMerchants(
  startDate: string,
  endDate: string,
  limit: number
) {
  const { getToken } = useAuth();

  return useQuery({
    queryKey: ["top-merchants", startDate, endDate, limit],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return fetchTopMerchants(token, startDate, endDate, limit);
    },
  });
}

export function useCategoryVendors(
  categoryId: string | undefined,
  startDate: string,
  endDate: string,
  limit: number = 20
) {
  const { getToken } = useAuth();

  return useQuery({
    queryKey: ["category-vendors", categoryId, startDate, endDate, limit],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return fetchCategoryVendors(token, categoryId!, startDate, endDate, limit);
    },
    enabled: !!categoryId,
  });
}
