import { apiFetch } from "@/api/client";
import type {
  SpendingByCategory,
  SpendingByCategoryOverTime,
  SpendingTrend,
  BudgetVsActual,
  MonthlyComparison,
  IncomeVsExpense,
  TopMerchant,
  CategoryVendor,
} from "@/types/models";

export async function fetchSpendingByCategory(
  token: string,
  startDate: string,
  endDate: string
): Promise<SpendingByCategory[]> {
  const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
  return apiFetch<SpendingByCategory[]>(
    `/api/v1/reports/spending-by-category?${params}`,
    {},
    token
  );
}

export async function fetchSpendingByCategoryOverTime(
  token: string,
  startDate: string,
  endDate: string,
  granularity: string,
  categoryIds?: string[],
): Promise<SpendingByCategoryOverTime[]> {
  const params = new URLSearchParams({
    start_date: startDate,
    end_date: endDate,
    granularity,
  });
  if (categoryIds?.length) {
    params.set("category_ids", categoryIds.join(","));
  }
  return apiFetch<SpendingByCategoryOverTime[]>(
    `/api/v1/reports/spending-by-category-over-time?${params}`,
    {},
    token
  );
}

export async function fetchSpendingTrends(
  token: string,
  startDate: string,
  endDate: string,
  granularity: string
): Promise<SpendingTrend[]> {
  const params = new URLSearchParams({
    start_date: startDate,
    end_date: endDate,
    granularity,
  });
  return apiFetch<SpendingTrend[]>(
    `/api/v1/reports/spending-trends?${params}`,
    {},
    token
  );
}

export async function fetchBudgetVsActual(
  token: string,
  startDate: string,
  endDate: string
): Promise<BudgetVsActual[]> {
  const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
  return apiFetch<BudgetVsActual[]>(
    `/api/v1/reports/budget-vs-actual?${params}`,
    {},
    token
  );
}

export async function fetchMonthlyComparison(
  token: string,
  months: number
): Promise<MonthlyComparison[]> {
  const params = new URLSearchParams({ months: months.toString() });
  return apiFetch<MonthlyComparison[]>(
    `/api/v1/reports/monthly-comparison?${params}`,
    {},
    token
  );
}

export async function fetchIncomeVsExpense(
  token: string,
  startDate: string,
  endDate: string,
  granularity: string
): Promise<IncomeVsExpense[]> {
  const params = new URLSearchParams({
    start_date: startDate,
    end_date: endDate,
    granularity,
  });
  return apiFetch<IncomeVsExpense[]>(
    `/api/v1/reports/income-vs-expense?${params}`,
    {},
    token
  );
}

export async function fetchTopMerchants(
  token: string,
  startDate: string,
  endDate: string,
  limit: number
): Promise<TopMerchant[]> {
  const params = new URLSearchParams({
    start_date: startDate,
    end_date: endDate,
    limit: limit.toString(),
  });
  return apiFetch<TopMerchant[]>(
    `/api/v1/reports/top-merchants?${params}`,
    {},
    token
  );
}

export async function fetchCategoryVendors(
  token: string,
  categoryId: string,
  startDate: string,
  endDate: string,
  limit: number = 20
): Promise<CategoryVendor[]> {
  const params = new URLSearchParams({
    category_id: categoryId,
    start_date: startDate,
    end_date: endDate,
    limit: limit.toString(),
  });
  return apiFetch<CategoryVendor[]>(
    `/api/v1/reports/category-vendors?${params}`,
    {},
    token
  );
}
