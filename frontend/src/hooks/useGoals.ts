import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/clerk-react";
import {
  getGoals,
  getGoal,
  getGoalSummary,
  createGoal,
  updateGoal,
  deleteGoal,
  addContribution,
  getContributions,
} from "@/api/goals";
import type { CreateGoalData, CreateContributionData } from "@/types/models";

export function useGoals(activeOnly: boolean = true) {
  const { getToken } = useAuth();

  return useQuery({
    queryKey: ["goals", activeOnly],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return getGoals(token, activeOnly);
    },
  });
}

export function useGoal(goalId: string) {
  const { getToken } = useAuth();

  return useQuery({
    queryKey: ["goal", goalId],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return getGoal(goalId, token);
    },
    enabled: !!goalId,
  });
}

export function useGoalSummary() {
  const { getToken } = useAuth();

  return useQuery({
    queryKey: ["goal-summary"],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return getGoalSummary(token);
    },
  });
}

export function useCreateGoal() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateGoalData) => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return createGoal(data, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      queryClient.invalidateQueries({ queryKey: ["goal-summary"] });
    },
  });
}

export function useUpdateGoal() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<CreateGoalData>;
    }) => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return updateGoal(id, data, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      queryClient.invalidateQueries({ queryKey: ["goal-summary"] });
    },
  });
}

export function useDeleteGoal() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return deleteGoal(id, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      queryClient.invalidateQueries({ queryKey: ["goal-summary"] });
    },
  });
}

export function useAddContribution() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      goalId,
      data,
    }: {
      goalId: string;
      data: CreateContributionData;
    }) => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return addContribution(goalId, data, token);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      queryClient.invalidateQueries({ queryKey: ["goal-summary"] });
      queryClient.invalidateQueries({
        queryKey: ["goal", variables.goalId],
      });
      queryClient.invalidateQueries({
        queryKey: ["contributions", variables.goalId],
      });
    },
  });
}

export function useContributions(goalId: string) {
  const { getToken } = useAuth();

  return useQuery({
    queryKey: ["contributions", goalId],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return getContributions(goalId, token);
    },
    enabled: !!goalId,
  });
}
