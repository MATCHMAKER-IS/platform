/**
 * 送信（outbound）Webhook。イベント（例 "invoice.created"）を購読 URL へ署名付きで配信する仕組み。
 * 既存の @platform/webhook は受信専用のため、送信側をアプリに用意する。純ロジック＋ストア。
 * @packageDocumentation
 */
import { createHmac } from "node:crypto";

/** 購読。指定イベントを URL へ配信。secret で HMAC 署名。 */
export interface WebhookSubscription {
  id: string;
  url: string;
  events: string[];
  secret: string;
  active: boolean;
  createdAt: string;
}

/** 購読作成の入力。 */
export interface SubscriptionInput {
  url: string;
  events: string[];
  secret: string;
}

/** イベントに一致する（有効な）購読。events に "*" を含めば全イベント対象。 */
export function matchingSubscriptions(subs: WebhookSubscription[], event: string): WebhookSubscription[] {
  return subs.filter((s) => s.active && (s.events.includes("*") || s.events.includes(event)));
}

/** 配信ペイロード（署名対象の JSON 本文）。 */
export function buildPayload(event: string, data: unknown, at: string): string {
  return JSON.stringify({ event, data, at });
}

/** 本文の HMAC-SHA256 署名（16 進）。受信側は同じ secret で検証する。 */
export function signPayload(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/** 1 件の配信内容（呼び出し側が fetch で POST する）。 */
export interface WebhookDelivery {
  url: string;
  body: string;
  signature: string;
  event: string;
}

/** イベントに対する全配信を組み立てる。 */
export function buildDeliveries(subs: WebhookSubscription[], event: string, data: unknown, at: string): WebhookDelivery[] {
  const payload = buildPayload(event, data, at);
  return matchingSubscriptions(subs, event).map((s) => ({ url: s.url, body: payload, signature: signPayload(s.secret, payload), event }));
}

/** 購読ストア。 */
export interface WebhookSubscriptionStore {
  list(): Promise<WebhookSubscription[]>;
  add(input: SubscriptionInput): Promise<WebhookSubscription>;
  setActive(id: string, active: boolean): Promise<void>;
  remove(id: string): Promise<void>;
}

let memSeq = 0;

/** インメモリ実装。 */
export function createMemoryWebhookSubscriptionStore(): WebhookSubscriptionStore {
  const items: WebhookSubscription[] = [];
  return {
    async list() {
      return items.map((s) => ({ ...s, events: [...s.events] }));
    },
    async add(input) {
      const sub: WebhookSubscription = { id: `wh${memSeq++}`, url: input.url, events: [...input.events], secret: input.secret, active: true, createdAt: new Date().toISOString() };
      items.push(sub);
      return { ...sub, events: [...sub.events] };
    },
    async setActive(id, active) {
      const s = items.find((x) => x.id === id);
      if (s) s.active = active;
    },
    async remove(id) {
      const i = items.findIndex((x) => x.id === id);
      if (i >= 0) items.splice(i, 1);
    },
  };
}

// ── Prisma 実装 ──

/** WebhookSubscriptionRow の必要部分（events は CSV）。 */
export interface WebhookSubscriptionRow {
  id: string;
  url: string;
  events: string;
  secret: string;
  active: boolean;
  createdAt: string;
}

/** 使用する Prisma デリゲートの最小ポート。 */
export interface WebhookSubscriptionStoreDb {
  webhookSubscriptionRow: {
    findMany(args: { orderBy: { createdAt: "desc" } }): Promise<WebhookSubscriptionRow[]>;
    create(args: { data: { url: string; events: string; secret: string; active: boolean; createdAt: string } }): Promise<WebhookSubscriptionRow>;
    update(args: { where: { id: string }; data: { active: boolean } }): Promise<WebhookSubscriptionRow>;
    delete(args: { where: { id: string } }): Promise<WebhookSubscriptionRow>;
  };
}

const rowToSub = (row: WebhookSubscriptionRow): WebhookSubscription => ({ id: row.id, url: row.url, events: row.events ? row.events.split(",") : [], secret: row.secret, active: row.active, createdAt: row.createdAt });

/** Prisma 実装。 */
export function createPrismaWebhookSubscriptionStore(db: WebhookSubscriptionStoreDb): WebhookSubscriptionStore {
  return {
    async list() {
      return (await db.webhookSubscriptionRow.findMany({ orderBy: { createdAt: "desc" } })).map(rowToSub);
    },
    async add(input) {
      const row = await db.webhookSubscriptionRow.create({ data: { url: input.url, events: input.events.join(","), secret: input.secret, active: true, createdAt: new Date().toISOString() } });
      return rowToSub(row);
    },
    async setActive(id, active) {
      await db.webhookSubscriptionRow.update({ where: { id }, data: { active } });
    },
    async remove(id) {
      await db.webhookSubscriptionRow.delete({ where: { id } });
    },
  };
}
