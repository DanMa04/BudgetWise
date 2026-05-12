import { apiFetch } from "@/api/client";
import type {
  CreateTransactionData,
  PaginatedResponse,
  Transaction,
  TransactionFilters,
} from "@/types/models";

export async function getTransactions(
  params: TransactionFilters,
  token: string
): Promise<PaginatedResponse<Transaction>> {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      searchParams.set(key, String(value));
    }
  }
  const query = searchParams.toString();
  const path = `/api/v1/transactions${query ? `?${query}` : ""}`;
  return apiFetch<PaginatedResponse<Transaction>>(path, {}, token);
}

export async function createTransaction(
  data: CreateTransactionData,
  token: string
): Promise<Transaction> {
  return apiFetch<Transaction>(
    "/api/v1/transactions",
    {
      method: "POST",
      body: JSON.stringify(data),
    },
    token
  );
}

export async function updateTransaction(
  id: string,
  data: Partial<CreateTransactionData>,
  token: string
): Promise<Transaction> {
  return apiFetch<Transaction>(
    `/api/v1/transactions/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify(data),
    },
    token
  );
}

export async function deleteTransaction(
  id: string,
  token: string
): Promise<void> {
  await apiFetch<void>(
    `/api/v1/transactions/${id}`,
    { method: "DELETE" },
    token
  );
}
