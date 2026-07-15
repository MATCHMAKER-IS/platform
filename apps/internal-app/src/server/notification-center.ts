/**
 * 通知センター。アプリ横断の通知をユーザーごとに貯め、未読管理する。
 * UI の AppNotification と同形。既定インメモリ、本番は Prisma に差し替え可能。
 * @packageDocumentation
 */

/** 通知の種別。 */
export type NotificationKind = "info" | "success" | "warning" | "error" | "mention";

/** 貯める通知(UI の AppNotification と同形)。 */
export interface AppNotification {
  id: string;
  title: string;
  body?: string;
  href?: string;
  createdAt: string;
  read?: boolean;
  kind?: NotificationKind;
}

/** 通知作成の入力。 */
export interface NewNotification {
  title: string;
  body?: string;
  href?: string;
  kind?: NotificationKind;
}

/** 通知ストア(非同期)。 */
export interface NotificationStore {
  /** ユーザーに通知を積む。 */
  add(userId: string, notification: AppNotification): Promise<void>;
  /** 一覧(新しい順)。unreadOnly で未読のみ。 */
  list(userId: string, options?: { unreadOnly?: boolean; limit?: number }): Promise<AppNotification[]>;
  /** 未読件数。 */
  unreadCount(userId: string): Promise<number>;
  /** 1 件を既読にする。 */
  markRead(userId: string, id: string): Promise<void>;
  /** すべて既読にする。 */
  markAllRead(userId: string): Promise<void>;
}

/** 通知センター(サービス)。 */
export interface NotificationCenter {
  store: NotificationStore;
  /** 新規 ID を振って通知を送る。 */
  notify(userId: string, notification: NewNotification): Promise<AppNotification>;
}

/** 一覧の絞り込み・整列を共通化。 */
function selectNotifications(all: AppNotification[], options: { unreadOnly?: boolean; limit?: number } = {}): AppNotification[] {
  let rows = all.slice().sort((a, b) => (a.createdAt > b.createdAt ? -1 : a.createdAt < b.createdAt ? 1 : 0));
  if (options.unreadOnly) rows = rows.filter((n) => !n.read);
  if (options.limit !== undefined) rows = rows.slice(0, options.limit);
  return rows;
}

/** インメモリ実装。 */
export function createMemoryNotificationStore(options: { keepPerUser?: number } = {}): NotificationStore {
  const keep = options.keepPerUser ?? 200;
  const byUser = new Map<string, AppNotification[]>();
  return {
    async add(userId, notification) {
      const list = byUser.get(userId) ?? [];
      list.push(notification);
      if (list.length > keep) list.splice(0, list.length - keep);
      byUser.set(userId, list);
    },
    async list(userId, opts) {
      return selectNotifications(byUser.get(userId) ?? [], opts);
    },
    async unreadCount(userId) {
      return (byUser.get(userId) ?? []).filter((n) => !n.read).length;
    },
    async markRead(userId, id) {
      const list = byUser.get(userId);
      if (!list) return;
      const n = list.find((x) => x.id === id);
      if (n) n.read = true;
    },
    async markAllRead(userId) {
      for (const n of byUser.get(userId) ?? []) n.read = true;
    },
  };
}

/** サービスを作る。 */
export function createNotificationCenter(store: NotificationStore, newId: () => string): NotificationCenter {
  return {
    store,
    async notify(userId, input) {
      const notification: AppNotification = { id: newId(), title: input.title, createdAt: new Date().toISOString(), read: false };
      if (input.body !== undefined) notification.body = input.body;
      if (input.href !== undefined) notification.href = input.href;
      if (input.kind !== undefined) notification.kind = input.kind;
      await store.add(userId, notification);
      return notification;
    },
  };
}

// ── Prisma 実装 ──

/** NotificationRow(Prisma 生成型の必要部分)。 */
export interface NotificationRow {
  id: string;
  userId: string;
  title: string;
  body: string | null;
  href: string | null;
  kind: string | null;
  read: boolean;
  createdAt: Date;
}

/** 使用する Prisma デリゲートの最小ポート。 */
export interface NotificationStoreDb {
  notificationRow: {
    create(args: { data: { id: string; userId: string; title: string; body: string | null; href: string | null; kind: string | null; read: boolean; createdAt: Date } }): Promise<unknown>;
    findMany(args: { where: { userId: string; read?: boolean }; orderBy: { createdAt: "desc" }; take?: number }): Promise<NotificationRow[]>;
    count(args: { where: { userId: string; read: boolean } }): Promise<number>;
    update(args: { where: { id: string }; data: { read: boolean } }): Promise<unknown>;
    updateMany(args: { where: { userId: string; read: boolean }; data: { read: boolean } }): Promise<unknown>;
  };
}

function rowToNotification(row: NotificationRow): AppNotification {
  const n: AppNotification = { id: row.id, title: row.title, createdAt: row.createdAt.toISOString(), read: row.read };
  if (row.body) n.body = row.body;
  if (row.href) n.href = row.href;
  if (row.kind) n.kind = row.kind as NotificationKind;
  return n;
}

/** Prisma 実装。 */
export function createPrismaNotificationStore(db: NotificationStoreDb): NotificationStore {
  return {
    async add(userId, notification) {
      await db.notificationRow.create({
        data: {
          id: notification.id,
          userId,
          title: notification.title,
          body: notification.body ?? null,
          href: notification.href ?? null,
          kind: notification.kind ?? null,
          read: notification.read ?? false,
          createdAt: new Date(notification.createdAt),
        },
      });
    },
    async list(userId, opts = {}) {
      const where = opts.unreadOnly ? { userId, read: false } : { userId };
      const rows = await db.notificationRow.findMany({ where, orderBy: { createdAt: "desc" }, ...(opts.limit !== undefined ? { take: opts.limit } : {}) });
      return rows.map(rowToNotification);
    },
    async unreadCount(userId) {
      return db.notificationRow.count({ where: { userId, read: false } });
    },
    async markRead(userId, id) {
      await db.notificationRow.update({ where: { id }, data: { read: true } });
    },
    async markAllRead(userId) {
      await db.notificationRow.updateMany({ where: { userId, read: false }, data: { read: true } });
    },
  };
}
