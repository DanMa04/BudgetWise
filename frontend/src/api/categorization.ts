import { apiFetch } from "@/api/client";
import type {
  CategorizationRule,
  CategorizationResponse,
  CreateRuleData,
  SubscriptionSuggestion,
} from "@/types/models";

export async function getRules(
  token: string,
  categoryId?: string
): Promise<CategorizationRule[]> {
  const query = categoryId ? `?category_id=${categoryId}` : "";
  return apiFetch<CategorizationRule[]>(
    `/api/v1/categorization/rules${query}`,
    {},
    token
  );
}

export async function createRule(
  data: CreateRuleData,
  token: string
): Promise<CategorizationRule> {
  return apiFetch<CategorizationRule>(
    "/api/v1/categorization/rules",
    {
      method: "POST",
      body: JSON.stringify(data),
    },
    token
  );
}

export async function updateRule(
  ruleId: string,
  data: Partial<CreateRuleData>,
  token: string
): Promise<CategorizationRule> {
  return apiFetch<CategorizationRule>(
    `/api/v1/categorization/rules/${ruleId}`,
    {
      method: "PATCH",
      body: JSON.stringify(data),
    },
    token
  );
}

export async function deleteRule(
  ruleId: string,
  token: string
): Promise<void> {
  await apiFetch<void>(
    `/api/v1/categorization/rules/${ruleId}`,
    { method: "DELETE" },
    token
  );
}

export async function predictCategory(
  description: string,
  token: string
): Promise<CategorizationResponse> {
  return apiFetch<CategorizationResponse>(
    "/api/v1/categorization/predict",
    {
      method: "POST",
      body: JSON.stringify({ description }),
    },
    token
  );
}

export async function correctTransaction(
  transactionId: string,
  categoryId: string,
  createRuleFlag: boolean,
  token: string
): Promise<void> {
  await apiFetch<void>(
    `/api/v1/categorization/correct/${transactionId}`,
    {
      method: "POST",
      body: JSON.stringify({
        category_id: categoryId,
        create_rule: createRuleFlag,
      }),
    },
    token
  );
}

export async function bulkCategorize(
  transactionIds: string[],
  categoryId: string,
  token: string
): Promise<void> {
  await apiFetch<void>(
    "/api/v1/categorization/bulk-categorize",
    {
      method: "POST",
      body: JSON.stringify({
        transaction_ids: transactionIds,
        category_id: categoryId,
      }),
    },
    token
  );
}

export async function trainModel(token: string): Promise<void> {
  await apiFetch<void>(
    "/api/v1/categorization/train",
    { method: "POST" },
    token
  );
}

export async function rescanTransactions(
  token: string,
  categoryId?: string
): Promise<{ scanned: number; updated: number }> {
  const params = categoryId ? `?category_id=${categoryId}` : "";
  return apiFetch<{ scanned: number; updated: number }>(
    `/api/v1/categorization/rescan${params}`,
    { method: "POST" },
    token
  );
}

export async function confirmImportCategories(
  token: string
): Promise<{ confirmed: number }> {
  return apiFetch<{ confirmed: number }>(
    "/api/v1/categorization/confirm-imports",
    { method: "POST" },
    token
  );
}

export async function getSubscriptionSuggestions(
  token: string
): Promise<SubscriptionSuggestion[]> {
  return apiFetch<SubscriptionSuggestion[]>(
    "/api/v1/categorization/subscription-suggestions",
    {},
    token
  );
}

export async function applySubscriptionSuggestion(
  data: {
    transaction_ids: string[];
    category_id: string;
    merchant_pattern: string;
    create_rule: boolean;
  },
  token: string
): Promise<{ updated: number }> {
  return apiFetch<{ updated: number }>(
    "/api/v1/categorization/subscription-suggestions/apply",
    {
      method: "POST",
      body: JSON.stringify(data),
    },
    token
  );
}
