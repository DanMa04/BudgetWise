import { apiFetch } from "./client";

export interface ExtensionTokenStatus {
  is_connected: boolean;
  expires_at: string | null;
}

export async function createExtensionToken(token: string): Promise<{ token: string; expires_at: string }> {
  return apiFetch("/api/v1/extension/tokens", { method: "POST" }, token);
}

export async function revokeExtensionToken(token: string): Promise<void> {
  return apiFetch("/api/v1/extension/tokens", { method: "DELETE" }, token);
}

export async function getExtensionTokenStatus(token: string): Promise<ExtensionTokenStatus> {
  return apiFetch("/api/v1/extension/tokens/status", {}, token);
}
