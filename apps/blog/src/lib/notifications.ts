import { API_URL, authedFetchResponse } from "./api";

export interface NotificationItem {
  id: number;
  notification_type: string;
  read: boolean;
  created_at: string;
  title?: string;
  data?: Record<string, unknown>;
  content?: string | null;
  url?: string | null;
  actor?: {
    id: number;
    username: string;
    display_name?: string | null;
    avatar?: string | null;
  } | null;
}

export interface NotificationsPage {
  notifications: NotificationItem[];
  total_rows_notifications: number;
  seen_notification_id: number | null;
  load_more_notifications: string | null;
}

async function request<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const isAbsolute = path.startsWith("http://") || path.startsWith("https://");
  const res = await authedFetchResponse(isAbsolute ? path : `${API_URL}${path}`, init, token);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw Object.assign(new Error(text || `HTTP ${res.status}`), {
      status: res.status,
    });
  }
  return (await res.json()) as T;
}

export async function listNotifications(
  params: { limit?: number; offset?: number; unread_only?: boolean; url?: string } = {},
  token?: string
): Promise<NotificationsPage> {
  const { limit = 20, offset = 0, unread_only = false, url } = params;
  if (url) {
    return request<NotificationsPage>(url, { method: "GET" }, token);
  }
  const qs = new URLSearchParams();
  qs.set("limit", String(limit));
  qs.set("offset", String(offset));
  qs.set("unread_only", String(Boolean(unread_only)));
  return request<NotificationsPage>(`/notifications?${qs.toString()}`, { method: "GET" }, token);
}

export async function getNotificationById(
  id: number | string,
  token?: string
): Promise<NotificationItem | null> {
  try {
    const res = await request<{ notification?: NotificationItem } | NotificationItem>(
      `/notifications/${id}`,
      { method: "GET" },
      token
    );
    if (res && typeof res === "object" && "notification" in res) {
      return res.notification ?? null;
    }
    return (res as NotificationItem) ?? null;
  } catch {
    return null;
  }
}

export async function markNotificationsAsRead(
  ids: Array<number | string>,
  token?: string
): Promise<boolean> {
  try {
    await request(
      `/notifications/mark-read`,
      {
        method: "POST",
        body: JSON.stringify({ notification_ids: ids }),
      },
      token
    );
    return true;
  } catch {
    return false;
  }
}

export async function markAllNotificationsAsRead(token?: string): Promise<boolean> {
  try {
    await request(`/notifications/read_all`, { method: "PUT" }, token);
    return true;
  } catch {
    return false;
  }
}

export async function getUnreadNotificationCount(token?: string): Promise<{ count: number }> {
  try {
    return await request<{ count: number }>(
      `/notifications/unread-count`,
      { method: "GET" },
      token
    );
  } catch {
    return { count: 0 };
  }
}

export async function deleteNotifications(
  ids: Array<number | string>,
  token?: string
): Promise<boolean> {
  try {
    await request(
      `/notifications`,
      {
        method: "DELETE",
        body: JSON.stringify({ notification_ids: ids }),
      },
      token
    );
    return true;
  } catch {
    return false;
  }
}
