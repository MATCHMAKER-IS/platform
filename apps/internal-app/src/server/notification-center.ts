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

/**
 * 通知一覧の既定件数。
 *
 * **通知は溜まり続ける。** 上限を付けないと、長く使っている利用者ほど
 * 全件を読み込んで遅くなる。画面は「最近のもの」しか見ないので 50 で足りる。
 */
const DEFAULT_NOTIFICATION_LIMIT = 50;

/** 一度に返す上限。**画面のクエリ文字列から渡る前提**で決める。 */
const MAX_NOTIFICATION_LIMIT = 200;

/** 一覧の絞り込み・整列を共通化。 */
function selectNotifications(all: AppNotification[], options: { unreadOnly?: boolean; limit?: number } = {}): AppNotification[] {
  let rows = all.slice().sort((a, b) => (a.createdAt > b.createdAt ? -1 : a.createdAt < b.createdAt ? 1 : 0));
  if (options.unreadOnly) rows = rows.filter((n) => !n.read);
  // **Prisma 実装と同じ既定・上限にする。** 片方だけ全件返すと、
  // 開発(メモリ)では気づかず本番でだけ遅い、という形になる
  const asked = options.limit;
  const take = Number.isInteger(asked) && asked !== undefined && asked > 0
    ? Math.min(asked, MAX_NOTIFICATION_LIMIT)
    : DEFAULT_NOTIFICATION_LIMIT;
  rows = rows.slice(0, take);
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
    // **`id` と `read` はどちらも任意**。markRead は `{ id, userId }` で絞り(他人の通知を
    // 既読にできないようにする)、markAllRead は `{ userId, read: false }` で絞る。
    // 型を狭めると、正しい呼び出しが型エラーになる。
    updateMany(args: { where: { userId: string; id?: string; read?: boolean }; data: { read: boolean } }): Promise<unknown>;
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
      // **上限を必ず付ける。** 通知は溜まり続けるので、`limit` を渡さないと
      // **全件を読み込む**——長く使っている利用者ほど遅くなり、
      // ある日「通知を開くと固まる」という形で表面化する。
      // 上限の範囲外(0 以下・巨大な値)も既定に寄せる(2026-08)。
      const asked = opts.limit;
      const take = Number.isInteger(asked) && asked !== undefined && asked > 0
        ? Math.min(asked, MAX_NOTIFICATION_LIMIT)
        : DEFAULT_NOTIFICATION_LIMIT;
      // **上限を付ける。** 通知は**消さない限り増え続けます**——
      // 100 人が毎日 5 件受け取れば、**1 年で 18 万件**。
      // **画面に出すのは直近だけ**なので上で計算した `take` で足ります
      // ——それ以上を見たい人には、**期間で絞る画面**を用意してください。
      //
      // **`take: 100` という決め打ちが重複していた。** 上で計算した
      // `take` 変数を上書きしないよう削除した——オブジェクトリテラルで
      // 同名プロパティが 2 つあると後勝ちになるため実害は無かったが
      // (JS の仕様で `take` 変数の値が優先されていた)、意図が不明瞭な
      // 古いコードの残骸だった(2026-08、全 route.ts の一括型検査で発見)。
      const rows = await db.notificationRow.findMany({ where, orderBy: { createdAt: "desc" }, take });
      return rows.map(rowToNotification);
    },
    async unreadCount(userId) {
      return db.notificationRow.count({ where: { userId, read: false } });
    },
    async markRead(userId, id) {
      // **userId で必ず絞る**。id だけで更新すると、他人の通知 ID を知っていれば
      // 既読にできてしまう(メモリ実装は userId で絞っており、実装間で挙動が食い違っていた)。
      // 該当が無ければ 0 件更新で何も起きない、が正しい振る舞い。
      await db.notificationRow.updateMany({ where: { id, userId }, data: { read: true } });
    },
    async markAllRead(userId) {
      await db.notificationRow.updateMany({ where: { userId, read: false }, data: { read: true } });
    },
  };
}
