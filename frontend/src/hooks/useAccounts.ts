import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/clerk-react";
import { getAccounts } from "@/api/accounts";

export function useAccounts() {
  const { getToken } = useAuth();

  return useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return getAccounts(token);
    },
  });
}
