import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/clerk-react";
import {
  getTransferRules,
  createTransferRule,
  updateTransferRule,
  deleteTransferRule,
} from "@/api/transferRules";
import type { CreateTransferRuleData, UpdateTransferRuleData } from "@/types/models";

export function useTransferRules(sourceCategoryId?: string) {
  const { getToken } = useAuth();

  return useQuery({
    queryKey: ["transfer-rules", sourceCategoryId ?? "all"],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return getTransferRules(token, sourceCategoryId);
    },
  });
}

const INVALIDATION_KEYS = [
  ["transfer-rules"],
  ["transactions"],
  ["categories-with-spend"],
];

export function useCreateTransferRule() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateTransferRuleData) => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return createTransferRule(data, token);
    },
    onSuccess: () => {
      for (const key of INVALIDATION_KEYS) {
        queryClient.invalidateQueries({ queryKey: key });
      }
    },
  });
}

export function useUpdateTransferRule() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateTransferRuleData }) => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return updateTransferRule(id, data, token);
    },
    onSuccess: () => {
      for (const key of INVALIDATION_KEYS) {
        queryClient.invalidateQueries({ queryKey: key });
      }
    },
  });
}

export function useDeleteTransferRule() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return deleteTransferRule(id, token);
    },
    onSuccess: () => {
      for (const key of INVALIDATION_KEYS) {
        queryClient.invalidateQueries({ queryKey: key });
      }
    },
  });
}
