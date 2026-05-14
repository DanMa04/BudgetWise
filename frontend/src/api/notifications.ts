import { apiFetch } from "@/api/client";
import type {
  NotificationLogList,
  NotificationPreference,
  CreateNotificationPreference,
} from "@/types/models";

export async function fetchNotifications(
  page: number,
  perPage: number,
  token: string,
  unreadOnly?: boolean
): Promise<NotificationLogList> {
  const params = new URLSearchParams({
    page: String(page),
    per_page: String(perPage),
  });
  if (unreadOnly) {
    params.set("unread_only", "true");
  }
  return apiFetch<NotificationLogList>(
    `/api/v1/notifications?${params.toString()}`,
    {},
    token
  );
}

export async function fetchUnreadCount(
  token: string
): Promise<{ count: number }> {
  return apiFetch<{ count: number }>(
    "/api/v1/notifications/unread-count",
    {},
    token
  );
}

export async function markNotificationRead(
  id: string,
  token: string
): Promise<void> {
  await apiFetch<void>(
    `/api/v1/notifications/${id}/read`,
    { method: "POST" },
    token
  );
}

export async function markAllRead(token: string): Promise<void> {
  await apiFetch<void>(
    "/api/v1/notifications/read-all",
    { method: "POST" },
    token
  );
}

export async function deleteNotification(
  id: string,
  token: string
): Promise<void> {
  await apiFetch<void>(
    `/api/v1/notifications/${id}`,
    { method: "DELETE" },
    token
  );
}

export async function fetchPreferences(
  token: string
): Promise<NotificationPreference[]> {
  return apiFetch<NotificationPreference[]>(
    "/api/v1/notifications/preferences",
    {},
    token
  );
}

export async function upsertPreference(
  data: CreateNotificationPreference,
  token: string
): Promise<NotificationPreference> {
  return apiFetch<NotificationPreference>(
    "/api/v1/notifications/preferences",
    { method: "PUT", body: JSON.stringify(data) },
    token
  );
}

export async function deletePreference(
  id: string,
  token: string
): Promise<void> {
  await apiFetch<void>(
    `/api/v1/notifications/preferences/${id}`,
    { method: "DELETE" },
    token
  );
}

export async function checkAlerts(token: string): Promise<void> {
  await apiFetch<void>(
    "/api/v1/notifications/check",
    { method: "POST" },
    token
  );
}
