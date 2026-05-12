import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/clerk-react";
import { getCategories } from "@/api/categories";

export function useCategories() {
  const { getToken } = useAuth();

  return useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return getCategories(token);
    },
  });
}
