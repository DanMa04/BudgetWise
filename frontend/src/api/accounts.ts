import { apiFetch } from "@/api/client";
import type { Account, CreateAccountData } from "@/types/models";

export async function getAccounts(token: string): Promise<Account[]> {
  return apiFetch<Account[]>("/api/v1/accounts", {}, token);
}

export async function createAccount(
  data: CreateAccountData,
  token: string
): Promise<Account> {
  return apiFetch<Account>(
    "/api/v1/accounts",
    {
      method: "POST",
      body: JSON.stringify(data),
    },
    token
  );
}

export async function updateAccount(
  accountId: string,
  data: Partial<CreateAccountData>,
  token: string
): Promise<Account> {
  return apiFetch<Account>(
    `/api/v1/accounts/${accountId}`,
    {
      method: "PATCH",
      body: JSON.stringify(data),
    },
    token
  );
}
