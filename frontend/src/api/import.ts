import { apiFetch } from "@/api/client";
import type {
  AutoDetectResponse,
  ImportJob,
  ImportPreviewResponse,
} from "@/types/models";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export async function uploadFile(
  file: File,
  token: string
): Promise<AutoDetectResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_URL}/api/v1/import/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ detail: "Upload failed" }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function submitMapping(
  jobId: string,
  mapping: Record<string, string>,
  token: string
): Promise<{ valid: boolean; errors?: string[] }> {
  return apiFetch<{ valid: boolean; errors?: string[] }>(
    `/api/v1/import/${jobId}/map`,
    {
      method: "POST",
      body: JSON.stringify({ mapping }),
    },
    token
  );
}

export async function getPreview(
  jobId: string,
  token: string
): Promise<ImportPreviewResponse> {
  return apiFetch<ImportPreviewResponse>(
    `/api/v1/import/${jobId}/preview`,
    {},
    token
  );
}

export async function confirmImport(
  jobId: string,
  token: string
): Promise<ImportJob> {
  return apiFetch<ImportJob>(
    `/api/v1/import/${jobId}/confirm`,
    { method: "POST" },
    token
  );
}

export async function getImportHistory(
  token: string
): Promise<ImportJob[]> {
  return apiFetch<ImportJob[]>("/api/v1/import/history", {}, token);
}
