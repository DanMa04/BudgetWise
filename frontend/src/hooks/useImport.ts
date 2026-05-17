import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/clerk-react";
import {
  uploadFile,
  submitMapping,
  getPreview,
  confirmImport,
  deleteImport,
  getImportHistory,
} from "@/api/import";

export function useImportHistory() {
  const { getToken } = useAuth();

  return useQuery({
    queryKey: ["import-history"],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return getImportHistory(token);
    },
  });
}

export function useUploadFile() {
  const { getToken } = useAuth();

  return useMutation({
    mutationFn: async (file: File) => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return uploadFile(file, token);
    },
  });
}

export function useSubmitMapping() {
  const { getToken } = useAuth();

  return useMutation({
    mutationFn: async ({
      jobId,
      mapping,
    }: {
      jobId: string;
      mapping: Record<string, string>;
    }) => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return submitMapping(jobId, mapping, token);
    },
  });
}

export function useGetPreview() {
  const { getToken } = useAuth();

  return useMutation({
    mutationFn: async (jobId: string) => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return getPreview(jobId, token);
    },
  });
}

export function useConfirmImport() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (jobId: string) => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return confirmImport(jobId, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["import-history"] });
    },
  });
}

export function useDeleteImport() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (jobId: string) => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return deleteImport(jobId, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["import-history"] });
    },
  });
}
