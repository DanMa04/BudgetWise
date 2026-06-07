import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/clerk-react";
import { getMe, updateMe } from "@/api/user";
import type { BackendUserUpdate } from "@/types/models";

const QUERY_KEY = ["backend-user"];

export function useBackendUser() {
  const { getToken } = useAuth();
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return getMe(token);
    },
    staleTime: 30_000,
  });
}

export function useUpdateBackendUser() {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: BackendUserUpdate) => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return updateMe(patch, token);
    },
    onSuccess: (data) => {
      qc.setQueryData(QUERY_KEY, data);
      qc.invalidateQueries({ queryKey: ["onboarding-state"] });
      // Community rules may have just been seeded — refresh rule lists.
      qc.invalidateQueries({ queryKey: ["categorization-rules"] });
    },
  });
}
