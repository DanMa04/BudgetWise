import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/clerk-react";
import { analyzeCategories, applyProposal } from "@/api/aiCategorization";
import type { ProposedCategory, Assignment } from "@/api/aiCategorization";

export function useAnalyzeCategories() {
  const { getToken } = useAuth();

  return useMutation({
    mutationFn: async (mode: "subcategorize" | "merge") => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return analyzeCategories(mode, token);
    },
  });
}

export function useApplyProposal() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (proposal: {
      proposed_categories: ProposedCategory[];
      assignments: Assignment[];
    }) => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return applyProposal(proposal, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["categories-with-spend"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["snapshots"] });
      queryClient.invalidateQueries({ queryKey: ["rules"] });
      queryClient.invalidateQueries({ queryKey: ["transfer-rules"] });
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      queryClient.invalidateQueries({ queryKey: ["budget-summary"] });
    },
  });
}
