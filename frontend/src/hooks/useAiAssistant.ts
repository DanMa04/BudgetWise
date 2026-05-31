import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/clerk-react";
import {
  aiAssistantApply,
  aiAssistantChat,
  type AiChatMessage,
  type AiProposal,
} from "@/api/aiAssistant";

export function useAiAssistantChat() {
  const { getToken } = useAuth();

  return useMutation({
    mutationFn: async (messages: AiChatMessage[]) => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return aiAssistantChat(messages, token);
    },
  });
}

export function useAiAssistantApply() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (proposal: AiProposal) => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return aiAssistantApply(proposal, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      queryClient.invalidateQueries({ queryKey: ["budget-summary"] });
      queryClient.invalidateQueries({ queryKey: ["onboarding-state"] });
    },
  });
}
