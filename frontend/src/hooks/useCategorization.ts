import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/clerk-react";
import {
  getRules,
  createRule,
  updateRule,
  deleteRule,
  predictCategory,
  correctTransaction,
  bulkCategorize,
  trainModel,
  getSubscriptionSuggestions,
  applySubscriptionSuggestion,
  confirmImportCategories,
} from "@/api/categorization";
import type { CreateRuleData } from "@/types/models";

export function useRules(categoryId?: string) {
  const { getToken } = useAuth();

  return useQuery({
    queryKey: ["rules", categoryId],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return getRules(token, categoryId);
    },
  });
}

export function useCreateRule() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateRuleData) => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return createRule(data, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rules"] });
    },
  });
}

export function useUpdateRule() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<CreateRuleData>;
    }) => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return updateRule(id, data, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rules"] });
    },
  });
}

export function useDeleteRule() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return deleteRule(id, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rules"] });
    },
  });
}

export function usePredictCategory() {
  const { getToken } = useAuth();

  return useMutation({
    mutationFn: async (description: string) => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return predictCategory(description, token);
    },
  });
}

export function useCorrectTransaction() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      transactionId,
      categoryId,
      createRuleFlag,
    }: {
      transactionId: string;
      categoryId: string;
      createRuleFlag: boolean;
    }) => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return correctTransaction(transactionId, categoryId, createRuleFlag, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["rules"] });
    },
  });
}

export function useBulkCategorize() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      transactionIds,
      categoryId,
    }: {
      transactionIds: string[];
      categoryId: string;
    }) => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return bulkCategorize(transactionIds, categoryId, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
}

export function useTrainModel() {
  const { getToken } = useAuth();

  return useMutation({
    mutationFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return trainModel(token);
    },
  });
}

export function useConfirmImportCategories() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return confirmImportCategories(token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
}

export function useSubscriptionSuggestions() {
  const { getToken } = useAuth();

  return useQuery({
    queryKey: ["subscription-suggestions"],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return getSubscriptionSuggestions(token);
    },
    staleTime: 30_000,
  });
}

export function useApplySubscription() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      transaction_ids: string[];
      category_id: string;
      merchant_pattern: string;
      create_rule: boolean;
    }) => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return applySubscriptionSuggestion(data, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscription-suggestions"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
}
