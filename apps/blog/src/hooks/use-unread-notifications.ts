"use client";

import * as React from "react";
import { useAuthToken } from "@/lib/auth";
import { getUnreadNotificationCount } from "@/lib/notifications";

const POLL_INTERVAL_MS = 60_000;

export function useUnreadNotifications() {
  const { token, ready, isAuthed } = useAuthToken();
  const [unread, setUnread] = React.useState(0);
  const [loading, setLoading] = React.useState(false);

  const refresh = React.useCallback(async () => {
    if (!isAuthed || !token) {
      setUnread(0);
      return 0;
    }
    setLoading(true);
    try {
      const { count } = await getUnreadNotificationCount(token);
      setUnread(count);
      return count;
    } catch {
      return unread;
    } finally {
      setLoading(false);
    }
  }, [isAuthed, token, unread]);

  React.useEffect(() => {
    if (!ready) return;
    void refresh();
    if (!isAuthed) return;

    const timer = window.setInterval(() => void refresh(), POLL_INTERVAL_MS);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, isAuthed, token]);

  return { unread, loading, refresh, setUnread };
}
