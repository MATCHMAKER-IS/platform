"use client";
/**
 * 通知センター。/api/notifications を取得し、@platform/ui の NotificationBell で表示・既読化する。
 * @packageDocumentation
 */
import * as React from "react";
import { NotificationBell, type AppNotification } from "@platform/ui";

export interface NotificationCenterClientProps {
  fetchImpl?: typeof fetch;
  pollMs?: number;
}

export function NotificationCenterClient({ fetchImpl, pollMs = 30000 }: NotificationCenterClientProps) {
  const [notifications, setNotifications] = React.useState<AppNotification[]>([]);
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;

  const load = React.useCallback(async () => {
    const res = await doFetch("/api/notifications?limit=50");
    if (!res.ok) return;
    const data = (await res.json()) as { notifications: AppNotification[] };
    setNotifications(data.notifications);
  }, []);

  React.useEffect(() => {
    void load();
    if (pollMs <= 0) return;
    const id = setInterval(() => void load(), pollMs);
    return () => clearInterval(id);
  }, [load, pollMs]);

  const onClick = (n: AppNotification) => {
    void doFetch("/api/notifications/read", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: n.id }) }).then(load);
  };
  const onMarkAllRead = () => {
    void doFetch("/api/notifications/read-all", { method: "POST" }).then(load);
  };

  return <NotificationBell notifications={notifications} onNotificationClick={onClick} onMarkAllRead={onMarkAllRead} viewAllHref="/notifications" />;
}
