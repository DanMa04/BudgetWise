import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/clerk-react";
import { resetBudget, wipeAllData } from "@/api/dev";

function invalidateEverything(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["accounts"] });
  qc.invalidateQueries({ queryKey: ["transactions"] });
  qc.invalidateQueries({ queryKey: ["categories"] });
  qc.invalidateQueries({ queryKey: ["categorization"] });
  qc.invalidateQueries({ queryKey: ["budgets"] });
  qc.invalidateQueries({ queryKey: ["budget-summary"] });
  qc.invalidateQueries({ queryKey: ["goals"] });
  qc.invalidateQueries({ queryKey: ["import-jobs"] });
  qc.invalidateQueries({ queryKey: ["snapshots"] });
  qc.invalidateQueries({ queryKey: ["plaid-items"] });
  qc.invalidateQueries({ queryKey: ["reports"] });
  qc.invalidateQueries({ queryKey: ["onboarding-state"] });
}

export function useWipeAllData() {
  const { getToken } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return wipeAllData(token);
    },
    onSuccess: () => invalidateEverything(qc),
  });
}

export function useResetBudget() {
  const { getToken } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return resetBudget(token);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["budgets"] });
      qc.invalidateQueries({ queryKey: ["budget-summary"] });
      qc.invalidateQueries({ queryKey: ["goals"] });
      qc.invalidateQueries({ queryKey: ["onboarding-state"] });
    },
  });
}
