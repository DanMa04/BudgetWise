import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/clerk-react";
import { getAccounts, createAccount, updateAccount } from "@/api/accounts";
import type { CreateAccountData } from "@/types/models";

export function useAccounts() {
  const { getToken } = useAuth();

  return useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return getAccounts(token);
    },
  });
}

export function useCreateAccount() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateAccountData) => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return createAccount(data, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
  });
}

export function useUpdateAccount() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      accountId,
      data,
    }: {
      accountId: string;
      data: Partial<CreateAccountData>;
    }) => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return updateAccount(accountId, data, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
  });
}
