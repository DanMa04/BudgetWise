import { apiFetch } from "@/api/client";
import type { PlaidItem, LinkTokenResponse, SyncResponse } from "@/types/models";

export async function createLinkToken(
  token: string
): Promise<LinkTokenResponse> {
  return apiFetch<LinkTokenResponse>(
    "/api/v1/plaid/link-token",
    { method: "POST" },
    token
  );
}

export async function exchangeToken(
  data: {
    public_token: string;
    institution_id: string;
    institution_name: string;
  },
  token: string
): Promise<PlaidItem> {
  return apiFetch<PlaidItem>(
    "/api/v1/plaid/exchange-token",
    {
      method: "POST",
      body: JSON.stringify(data),
    },
    token
  );
}

export async function getPlaidItems(token: string): Promise<PlaidItem[]> {
  return apiFetch<PlaidItem[]>("/api/v1/plaid/items", {}, token);
}

export async function syncItem(
  itemId: string,
  token: string
): Promise<SyncResponse> {
  return apiFetch<SyncResponse>(
    `/api/v1/plaid/items/${itemId}/sync`,
    { method: "POST" },
    token
  );
}

export async function syncAll(token: string): Promise<SyncResponse[]> {
  return apiFetch<SyncResponse[]>(
    "/api/v1/plaid/sync",
    { method: "POST" },
    token
  );
}

export async function unlinkItem(
  itemId: string,
  token: string
): Promise<void> {
  return apiFetch<void>(
    `/api/v1/plaid/items/${itemId}`,
    { method: "DELETE" },
    token
  );
}
