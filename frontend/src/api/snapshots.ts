import { apiFetch } from "@/api/client";

export interface Snapshot {
  id: string;
  name: string;
  trigger: string;
  category_count: number;
  rule_count: number;
  created_at: string;
}

export interface RestoreResult {
  categories_restored: number;
  rules_restored: number;
  transfer_rules_restored: number;
  transactions_updated: number;
}

export async function getSnapshots(token: string): Promise<Snapshot[]> {
  return apiFetch<Snapshot[]>("/api/v1/snapshots/", {}, token);
}

export async function createSnapshot(token: string): Promise<Snapshot> {
  return apiFetch<Snapshot>(
    "/api/v1/snapshots/",
    { method: "POST" },
    token
  );
}

export async function restoreSnapshot(
  snapshotId: string,
  token: string
): Promise<RestoreResult> {
  return apiFetch<RestoreResult>(
    `/api/v1/snapshots/${snapshotId}/restore`,
    { method: "POST" },
    token
  );
}

export async function deleteSnapshot(
  snapshotId: string,
  token: string
): Promise<void> {
  await apiFetch<void>(
    `/api/v1/snapshots/${snapshotId}`,
    { method: "DELETE" },
    token
  );
}
