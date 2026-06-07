import { apiFetch } from "@/api/client";
import type { BackendUser, BackendUserUpdate } from "@/types/models";

export async function getMe(token: string): Promise<BackendUser> {
  return apiFetch<BackendUser>("/api/v1/auth/me", {}, token);
}

export async function updateMe(
  patch: BackendUserUpdate,
  token: string
): Promise<BackendUser> {
  return apiFetch<BackendUser>(
    "/api/v1/auth/me",
    {
      method: "PATCH",
      body: JSON.stringify(patch),
    },
    token
  );
}
