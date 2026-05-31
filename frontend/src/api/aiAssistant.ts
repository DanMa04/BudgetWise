import { apiFetch } from "@/api/client";

export interface AiChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AiChatProgress {
  asked: number;
  estimated_total: number;
}

export interface AiProposedGoal {
  name: string;
  goal_type: "savings" | "debt_payoff" | "emergency_fund" | "custom";
  target_amount: number;
  target_date: string | null;
  planned_monthly_contribution: number | null;
  color: string | null;
}

export interface AiProposedAllocation {
  category_name: string;
  amount: number;
  is_locked: boolean;
}

export interface AiProposedGoalContribution {
  goal_name: string;
  monthly_amount: number;
}

export interface AiProposedBudget {
  monthly_income: number;
  period_type: string;
  allocations: AiProposedAllocation[];
  goal_contributions: AiProposedGoalContribution[];
}

export interface AiProposal {
  monthly_income: number | null;
  categorization: Record<string, unknown>;
  goals: AiProposedGoal[];
  budget: AiProposedBudget | null;
}

export interface AiChatResponse {
  phase: "questioning" | "proposing";
  message: string;
  progress: AiChatProgress | null;
  proposal: AiProposal | null;
}

export interface AiApplyResponse {
  categories_created: number;
  goals_created: number;
  budget_allocations_saved: number;
  transactions_categorized: number;
  snapshot_id: string | null;
}

export async function aiAssistantChat(
  messages: AiChatMessage[],
  token: string
): Promise<AiChatResponse> {
  return apiFetch<AiChatResponse>(
    "/api/v1/ai/assistant/chat",
    {
      method: "POST",
      body: JSON.stringify({
        messages,
        context: { include_transactions: true },
      }),
    },
    token
  );
}

export async function aiAssistantApply(
  proposal: AiProposal,
  token: string
): Promise<AiApplyResponse> {
  return apiFetch<AiApplyResponse>(
    "/api/v1/ai/assistant/apply",
    {
      method: "POST",
      body: JSON.stringify({ proposal }),
    },
    token
  );
}
