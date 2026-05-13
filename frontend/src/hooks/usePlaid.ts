import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/clerk-react";
import {
  createLinkToken,
  exchangeToken,
  getPlaidItems,
  syncItem,
  syncAll,
  unlinkItem,
} from "@/api/plaid";

export function usePlaidItems() {
  const { getToken } = useAuth();

  return useQuery({
    queryKey: ["plaid-items"],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return getPlaidItems(token);
    },
  });
}

export function useCreateLinkToken() {
  const { getToken } = useAuth();

  return useMutation({
    mutationFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return createLinkToken(token);
    },
  });
}

export function useExchangeToken() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      public_token: string;
      institution_id: string;
      institution_name: string;
    }) => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return exchangeToken(data, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["plaid-items"] });
    },
  });
}

export function useSyncItem() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (itemId: string) => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return syncItem(itemId, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
}

export function useSyncAll() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return syncAll(token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
}

export function useUnlinkItem() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (itemId: string) => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return unlinkItem(itemId, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plaid-items"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
  });
}
