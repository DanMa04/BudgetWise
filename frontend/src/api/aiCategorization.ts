import { apiFetch } from "@/api/client";

export interface ProposedCategory {
  name: string;
  existing_id: string | null;
  color: string;
  is_income?: boolean;
  children: {
    name: string;
    existing_id: string | null;
    color: string;
  }[];
  merged_from?: string[];
}

export interface Assignment {
  transaction_id: string;
  category_name: string;
}

export interface AnalyzeResult {
  proposed_categories: ProposedCategory[];
  assignments: Assignment[];
  summary: string;
  stats: {
    new_parent_categories: number;
    new_subcategories: number;
    categories_kept: number;
    categories_merged_away: number;
    transactions_assigned: number;
    total_transactions: number;
  };
}

export interface ApplyResult {
  categories_created: number;
  categories_updated: number;
  categories_deleted: number;
  transactions_updated: number;
}

export async function analyzeCategories(
  mode: "subcategorize" | "merge",
  token: string
): Promise<AnalyzeResult> {
  return apiFetch<AnalyzeResult>(
    "/api/v1/ai/categorize/analyze",
    {
      method: "POST",
      body: JSON.stringify({ mode }),
    },
    token
  );
}

export async function applyProposal(
  proposal: { proposed_categories: ProposedCategory[]; assignments: Assignment[] },
  token: string
): Promise<ApplyResult> {
  return apiFetch<ApplyResult>(
    "/api/v1/ai/categorize/apply",
    {
      method: "POST",
      body: JSON.stringify(proposal),
    },
    token
  );
}
