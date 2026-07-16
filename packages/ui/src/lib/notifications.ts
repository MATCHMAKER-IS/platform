/**
 * 通知の集計・グループ化(純ロジック・React 非依存)。
 * 未読数、既読化、日付グループ(今日/昨日/それ以前)への整理。
 * @packageDocumentation
 */

/** 通知の種類。 */
export type NotificationKind = "info" | "success" | "warning" | "error";

/** 1 件の通知。 */
export interface AppNotification {
  id: string;
  title: string;
  body?: string;
  href?: string;
  /** 作成日時(ISO 8601)。 */
  createdAt: string;
  /** 既読か。 */
  read?: boolean;
  kind?: NotificationKind;
}

/**
 * 未読件数を返す。
 *
 * @param notifications 通知の配列
 * @returns 未読の件数(**バッジに出す数**)
 */
export function unreadCount(notifications: AppNotification[]): number {
  return notifications.reduce((n, x) => n + (x.read ? 0 : 1), 0);
}

/**
 * 新しい順に並べる。
 *
 * @param notifications 通知の配列
 * @returns 並べ替えた新しい配列
 */
export function sortNotifications<T extends AppNotification>(notifications: T[]): T[] {
  return [...notifications].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * 指定した通知を既読にする。
 *
 * @param notifications 通知の配列
 * @param id 既読にする id
 * @returns 更新した**新しい配列**(元は変更しない)
 */
export function markRead<T extends AppNotification>(notifications: T[], id: string): T[] {
  return notifications.map((x) => (x.id === id ? { ...x, read: true } : x));
}

/**
 * すべて既読にする。
 *
 * @param notifications 通知の配列
 * @returns 更新した新しい配列
 */
export function markAllRead<T extends AppNotification>(notifications: T[]): T[] {
  return notifications.map((x) => (x.read ? x : { ...x, read: true }));
}

/** 日付グループ。 */
export interface NotificationGroups<T> {
  today: T[];
  yesterday: T[];
  earlier: T[];
}

/** その日の 0 時(ローカル)からの日数差を返す。 */
function dayDiff(iso: string, now: Date): number {
  const d = new Date(iso);
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const b = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((a - b) / 86_400_000);
}

/**
 * 通知を今日 / 昨日 / それ以前に分ける。
 *
 * **日付そのものより「いつ頃か」が分かる方が役に立つ**(通知は鮮度が重要)。
 *
 * @param notifications 通知の配列
 * @param now 基準時刻(テスト注入用)
 * @returns グループごとの通知(**各グループ内は新しい順**)
 */
export function groupByDate<T extends AppNotification>(notifications: T[], now: Date = new Date()): NotificationGroups<T> {
  const sorted = sortNotifications(notifications);
  const groups: NotificationGroups<T> = { today: [], yesterday: [], earlier: [] };
  for (const n of sorted) {
    const diff = dayDiff(n.createdAt, now);
    if (diff <= 0) groups.today.push(n);
    else if (diff === 1) groups.yesterday.push(n);
    else groups.earlier.push(n);
  }
  return groups;
}
