/**
 * ユーザーごとの通知プレファレンス。@platform/notify の resolveDelivery に委譲して、
 * カテゴリ別のオン/オフ・チャネル・静音時間を判定する。既定インメモリ、Prisma 差し替え可。
 * @packageDocumentation
 */
import { resolveDelivery, type NotificationPreference, type DeliveryDecision, type DeliveryChannel, type NotifiableEvent } from "@platform/notify";

/** 既定のプレファレンス（設定が無いユーザー用）。 */
export const DEFAULT_PREFERENCE: NotificationPreference = {
  defaultChannels: ["inApp", "email"],
};

/** プレファレンスストア（非同期）。 */
export interface PreferenceStore {
  /** 取得（未設定なら既定）。 */
  get(userId: string): Promise<NotificationPreference>;
  /** 保存（全置換）。 */
  set(userId: string, pref: NotificationPreference): Promise<void>;
}

/** インメモリ実装。 */
export function createMemoryPreferenceStore(): PreferenceStore {
  const byUser = new Map<string, NotificationPreference>();
  return {
    async get(userId) {
      return byUser.get(userId) ?? DEFAULT_PREFERENCE;
    },
    async set(userId, pref) {
      byUser.set(userId, { ...pref, userId });
    },
  };
}

/**
 * あるユーザー・カテゴリの配信可否を判定する。
 * 返り値の channels に "inApp" があれば通知センターへ、"email" があればメール送信する、などに使う。
 */
export async function decideDelivery(
  store: PreferenceStore,
  userId: string,
  event: NotifiableEvent,
  now: Date = new Date(),
): Promise<DeliveryDecision> {
  const pref = await store.get(userId);
  return resolveDelivery(pref, event, now);
}

/** チャネルが含まれるか。 */
export function hasChannel(decision: DeliveryDecision, channel: DeliveryChannel): boolean {
  return !decision.deferred && decision.channels.includes(channel);
}

// ── Prisma 実装 ──

/** NotificationPreferenceRow の必要部分。 */
export interface PreferenceRow {
  userId: string;
  defaultChannels: unknown;
  categories: unknown;
  quietStart: number | null;
  quietEnd: number | null;
}

/** 使用する Prisma デリゲートの最小ポート。 */
export interface PreferenceStoreDb {
  notificationPreferenceRow: {
    findUnique(args: { where: { userId: string } }): Promise<PreferenceRow | null>;
    upsert(args: {
      where: { userId: string };
      create: { userId: string; defaultChannels: unknown; categories: unknown; quietStart: number | null; quietEnd: number | null };
      update: { defaultChannels: unknown; categories: unknown; quietStart: number | null; quietEnd: number | null };
    }): Promise<unknown>;
  };
}

function rowToPreference(row: PreferenceRow): NotificationPreference {
  const pref: NotificationPreference = { userId: row.userId };
  if (Array.isArray(row.defaultChannels)) pref.defaultChannels = row.defaultChannels as DeliveryChannel[];
  if (row.categories && typeof row.categories === "object") pref.categories = row.categories as NotificationPreference["categories"];
  if (row.quietStart !== null && row.quietEnd !== null) pref.quietHours = { start: row.quietStart, end: row.quietEnd };
  return pref;
}

/** Prisma 実装。 */
export function createPrismaPreferenceStore(db: PreferenceStoreDb): PreferenceStore {
  return {
    async get(userId) {
      const row = await db.notificationPreferenceRow.findUnique({ where: { userId } });
      return row ? rowToPreference(row) : DEFAULT_PREFERENCE;
    },
    async set(userId, pref) {
      const data = {
        defaultChannels: pref.defaultChannels ?? [],
        categories: pref.categories ?? {},
        quietStart: pref.quietHours?.start ?? null,
        quietEnd: pref.quietHours?.end ?? null,
      };
      await db.notificationPreferenceRow.upsert({ where: { userId }, create: { userId, ...data }, update: data });
    },
  };
}
