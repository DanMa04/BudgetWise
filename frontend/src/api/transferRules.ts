import { apiFetch } from "@/api/client";
import type {
  TransferRule,
  CreateTransferRuleData,
  UpdateTransferRuleData,
} from "@/types/models";

export async function getTransferRules(
  token: string,
  sourceCategoryId?: string
): Promise<TransferRule[]> {
  const params = sourceCategoryId
    ? `?source_category_id=${sourceCategoryId}`
    : "";
  return apiFetch<TransferRule[]>(
    `/api/v1/transfer-rules/${params}`,
    {},
    token
  );
}

export async function createTransferRule(
  data: CreateTransferRuleData,
  token: string
): Promise<TransferRule> {
  return apiFetch<TransferRule>(
    "/api/v1/transfer-rules/",
    {
      method: "POST",
      body: JSON.stringify(data),
    },
    token
  );
}

export async function updateTransferRule(
  id: string,
  data: UpdateTransferRuleData,
  token: string
): Promise<TransferRule> {
  return apiFetch<TransferRule>(
    `/api/v1/transfer-rules/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify(data),
    },
    token
  );
}

export async function deleteTransferRule(
  id: string,
  token: string
): Promise<void> {
  await apiFetch<void>(
    `/api/v1/transfer-rules/${id}`,
    { method: "DELETE" },
    token
  );
}
