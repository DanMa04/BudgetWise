import { apiFetch } from "./client";

export async function exportMyData(token: string): Promise<void> {
  const data = await apiFetch<Record<string, unknown>>("/api/v1/auth/me/export", {}, token);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "kallio-data-export.json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function deleteMyAccount(token: string): Promise<void> {
  return apiFetch("/api/v1/auth/me", { method: "DELETE" }, token);
}
