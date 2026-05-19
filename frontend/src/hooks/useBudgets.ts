import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/clerk-react";
import {
  getBudgets,
  createBudget,
  getBudgetSummary,
  updateBudget,
  deleteBudget,
  getAllocationData,
  saveBulkBudget,
} from "@/api/budgets";
import type { BulkBudgetSave, CreateBudgetData } from "@/types/models";

export function useBudgets() {
  const { getToken } = useAuth();

  return useQuery({
    queryKey: ["budgets"],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return getBudgets(token);
    },
  });
}

export function useCreateBudget() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateBudgetData) => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return createBudget(data, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      queryClient.invalidateQueries({ queryKey: ["budget-summary"] });
    },
  });
}

export function useBudgetSummary() {
  const { getToken } = useAuth();

  return useQuery({
    queryKey: ["budget-summary"],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return getBudgetSummary(token);
    },
  });
}

export function useUpdateBudget() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<CreateBudgetData>;
    }) => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return updateBudget(id, data, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      queryClient.invalidateQueries({ queryKey: ["budget-summary"] });
    },
  });
}

export function useDeleteBudget() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return deleteBudget(id, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      queryClient.invalidateQueries({ queryKey: ["budget-summary"] });
    },
  });
}

export function useAllocationData() {
  const { getToken } = useAuth();

  return useQuery({
    queryKey: ["allocation-data"],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return getAllocationData(token);
    },
  });
}

export function useSaveBulkBudget() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: BulkBudgetSave) => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return saveBulkBudget(data, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      queryClient.invalidateQueries({ queryKey: ["budget-summary"] });
      queryClient.invalidateQueries({ queryKey: ["allocation-data"] });
      queryClient.invalidateQueries({ queryKey: ["goals"] });
    },
  });
}
