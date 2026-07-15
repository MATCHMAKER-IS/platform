"use client";
/**
 * useNotifications フック。初期通知 + リアルタイム購読(subscribe)を受け取り、通知状態を管理する。
 * subscribe は @platform/realtime の SSE/WS 等をラップして渡す。返り値を NotificationBell に渡す。
 * @packageDocumentation
 */
import * as React from "react";
import { type AppNotification, unreadCount } from "../lib/notifications.js";
import { notificationReducer, type NotificationAction } from "../lib/notification-store.js";

/** {@link useNotifications} のオプション。 */
export interface UseNotificationsOptions {
  /** 初期通知。 */
  initial?: AppNotification[];
  /**
   * リアルタイム購読。新着 1 件を push するコールバックを受け取り、解除関数を返す。
   * 例: (push) => realtime.subscribe("notifications", (msg) => push(JSON.parse(msg)))
   */
  subscribe?: (push: (n: AppNotification) => void) => () => void;
  /** 保持する最大件数。 */
  max?: number;
}

/** useNotifications の返り値。 */
export interface UseNotificationsResult {
  notifications: AppNotification[];
  unread: number;
  /** 新着を反映(手動 push 用)。 */
  receive: (n: AppNotification) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  remove: (id: string) => void;
  setAll: (notifications: AppNotification[]) => void;
}

/** 通知状態 + リアルタイム購読を管理するフック。 */
export function useNotifications(options: UseNotificationsOptions = {}): UseNotificationsResult {
  const { initial = [], subscribe, max } = options;

  const reducer = React.useCallback(
    (state: AppNotification[], action: NotificationAction) => notificationReducer(state, action, { max }),
    [max],
  );
  const [notifications, dispatch] = React.useReducer(reducer, initial);

  // リアルタイム購読
  React.useEffect(() => {
    if (!subscribe) return;
    const unsubscribe = subscribe((n) => dispatch({ type: "receive", notification: n }));
    return unsubscribe;
  }, [subscribe]);

  return {
    notifications,
    unread: unreadCount(notifications),
    receive: React.useCallback((n: AppNotification) => dispatch({ type: "receive", notification: n }), []),
    markRead: React.useCallback((id: string) => dispatch({ type: "read", id }), []),
    markAllRead: React.useCallback(() => dispatch({ type: "readAll" }), []),
    remove: React.useCallback((id: string) => dispatch({ type: "remove", id }), []),
    setAll: React.useCallback((n: AppNotification[]) => dispatch({ type: "set", notifications: n }), []),
  };
}
