import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/clerk-react";
import {
  getCategories,
  getCategoriesWithSpend,
  getMergeSuggestions,
  mergeCategories,
  createCategory,
  deleteCategory,
  subordinateCategory,
  unsubordinateCategory,
  resetGroups,
} from "@/api/categories";
import type {
  CreateCategoryData,
  MergeCategoryRequest,
  SubordinateCategoryRequest,
} from "@/types/models";

export function useCategories() {
  const { getToken } = useAuth();

  return useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return getCategories(token);
    },
  });
}

export function useCategoriesWithSpend() {
  const { getToken } = useAuth();

  return useQuery({
    queryKey: ["categories-with-spend"],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return getCategoriesWithSpend(token);
    },
  });
}

export function useMergeSuggestions(enabled = true) {
  const { getToken } = useAuth();

  return useQuery({
    queryKey: ["merge-suggestions"],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return getMergeSuggestions(token);
    },
    enabled,
  });
}

export function useMergeCategories() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: MergeCategoryRequest) => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return mergeCategories(data, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["categories-with-spend"] });
      queryClient.invalidateQueries({ queryKey: ["merge-suggestions"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      queryClient.invalidateQueries({ queryKey: ["budget-summary"] });
      queryClient.invalidateQueries({ queryKey: ["allocation-data"] });
    },
  });
}

export function useCreateCategory() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateCategoryData) => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return createCategory(data, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["categories-with-spend"] });
    },
  });
}

export function useDeleteCategory() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      id: string;
      reassign_to?: string;
      delete_transactions?: boolean;
    }) => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return deleteCategory(params.id, token, {
        reassign_to: params.reassign_to,
        delete_transactions: params.delete_transactions,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["categories-with-spend"] });
      queryClient.invalidateQueries({ queryKey: ["merge-suggestions"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      queryClient.invalidateQueries({ queryKey: ["budget-summary"] });
      queryClient.invalidateQueries({ queryKey: ["allocation-data"] });
    },
  });
}

const CATEGORY_INVALIDATION_KEYS = [
  ["categories"],
  ["categories-with-spend"],
  ["merge-suggestions"],
  ["allocation-data"],
  ["budgets"],
  ["budget-summary"],
];

export function useSubordinateCategory() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: SubordinateCategoryRequest) => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return subordinateCategory(data, token);
    },
    onSuccess: () => {
      for (const key of CATEGORY_INVALIDATION_KEYS) {
        queryClient.invalidateQueries({ queryKey: key });
      }
    },
  });
}

export function useUnsubordinateCategory() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (categoryId: string) => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return unsubordinateCategory(categoryId, token);
    },
    onSuccess: () => {
      for (const key of CATEGORY_INVALIDATION_KEYS) {
        queryClient.invalidateQueries({ queryKey: key });
      }
    },
  });
}

export function useResetGroups() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return resetGroups(token);
    },
    onSuccess: () => {
      for (const key of CATEGORY_INVALIDATION_KEYS) {
        queryClient.invalidateQueries({ queryKey: key });
      }
    },
  });
}
