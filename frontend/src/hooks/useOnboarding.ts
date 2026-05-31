import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/clerk-react";
import {
  dismissOnboarding,
  getOnboardingState,
  patchOnboardingState,
  resetOnboarding,
} from "@/api/onboarding";
import type { OnboardingPatch } from "@/types/models";

const QUERY_KEY = ["onboarding-state"];

export function useOnboardingState() {
  const { getToken } = useAuth();

  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return getOnboardingState(token);
    },
    staleTime: 30_000,
  });
}

export function useUpdateOnboardingState() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (patch: OnboardingPatch) => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return patchOnboardingState(patch, token);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(QUERY_KEY, data);
    },
  });
}

export function useDismissOnboarding() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return dismissOnboarding(token);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(QUERY_KEY, data);
    },
  });
}

export function useResetOnboarding() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return resetOnboarding(token);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(QUERY_KEY, data);
    },
  });
}
