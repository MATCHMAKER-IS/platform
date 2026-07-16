/**
 * 通知ストアのリデューサ(純ロジック・React 非依存)。
 * リアルタイム受信(@platform/realtime の SSE/WS 等)や既読操作を、通知配列に反映する。
 * useNotifications フックや任意の状態管理から使う。
 * @packageDocumentation
 */
import { type AppNotification, sortNotifications, markRead, markAllRead, unreadCount } from "./notifications.js";

/** 通知ストアのアクション。 */
export type NotificationAction =
  | { type: "set"; notifications: AppNotification[] }
  | { type: "receive"; notification: AppNotification }
  | { type: "read"; id: string }
  | { type: "readAll" }
  | { type: "remove"; id: string };

/** リデューサのオプション。 */
export interface NotificationReducerOptions {
  /** 保持する最大件数(超えたら古いものを捨てる)。 */
  max?: number;
}

/**
 * アクションを適用して新しい通知配列を返す(常に新しい順・ID 重複排除)。
 *
 *
 * @param state 現在の状態
 * @param action 操作
 * @returns 新しい状態(**useReducer に渡す**)
 */
export function notificationReducer(state: AppNotification[], action: NotificationAction, options: NotificationReducerOptions = {}): AppNotification[] {
  let next: AppNotification[];
  switch (action.type) {
    case "set":
      next = action.notifications;
      break;
    case "receive": {
      // 同一 ID は新しい方で置き換え
      const without = state.filter((n) => n.id !== action.notification.id);
      next = [action.notification, ...without];
      break;
    }
    case "read":
      next = markRead(state, action.id);
      break;
    case "readAll":
      next = markAllRead(state);
      break;
    case "remove":
      next = state.filter((n) => n.id !== action.id);
      break;
  }
  next = sortNotifications(next);
  if (options.max !== undefined && next.length > options.max) next = next.slice(0, options.max);
  return next;
}

/** 現在の未読数(再エクスポート)。 */
export { unreadCount };
