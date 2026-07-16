/**
 * `@platform/webhook` — Webhook 受信の共通枠組み。
 *
 * 外部サービス(Stripe/Zoho/LINE/GitHub 等)からの Webhook を安全に受ける定番処理を統一する:
 * (1) 署名検証(HMAC)、(2) 冪等処理(同一イベントの重複配送を1回に)、(3) イベントディスパッチ。
 * 冪等ストアは注入(@platform/observability の Idempotency 実装等)。署名は node:crypto の HMAC。
 * @packageDocumentation
 */
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * HMAC 署名を検証する。
 *
 * **必ず検証すること**(しないと誰でも偽の通知を送れる)。
 * **タイミング安全な比較**を使う(素朴な `===` だと、比較にかかる時間から
 * 正解の桁数を推測される)。
 *
 * @param payload 受け取った本文(**パースする前の生の文字列**。整形すると署名が合わない)
 * @param signature 署名ヘッダの値
 * @param secret 共有シークレット
 * @returns 正当なら true
 */
export function verifyHmacSignature(params: {
  /** リクエストの生ボディ(パース前の文字列)。 */
  payload: string;
  /** 受信した署名(ヘッダ値)。 */
  signature: string;
  /** 共有シークレット。 */
  secret: string;
  /** ハッシュアルゴリズム(既定 sha256)。 */
  algorithm?: string;
  /** 署名の接頭辞(例 "sha256=")。付いていれば取り除いて比較。 */
  prefix?: string;
}): boolean {
  const { payload, signature, secret, algorithm = "sha256", prefix = "" } = params;
  const expected = createHmac(algorithm, secret).update(payload).digest("hex");
  const received = signature.startsWith(prefix) ? signature.slice(prefix.length) : signature;
  // 長さが違うと timingSafeEqual が例外を投げるので先に弾く
  if (received.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(received, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

/** 冪等ストア(最小)。@platform/observability の Idempotency と互換。 */
export interface WebhookIdempotencyStore {
  /** eventId を予約。初回は true(処理してよい)、既に処理済みなら false。 */
  reserve(eventId: string): Promise<boolean> | boolean;
}

/**
 * Webhook 購読ストアのメモリ実装(開発・テスト用)。
 *
 * **本番では DB 実装を使うこと**(再起動で購読が消えると、通知が止まる)。
 *
 * @param seed 初期データ
 * @returns ストア
 */
export function createMemoryWebhookStore(ttlMs = 24 * 60 * 60 * 1000, now: () => number = () => Date.now()): WebhookIdempotencyStore {
  const seen = new Map<string, number>();
  return {
    reserve(eventId) {
      const t = now();
      for (const [k, exp] of seen) if (exp <= t) seen.delete(k);
      if (seen.has(eventId)) return false;
      seen.set(eventId, t + ttlMs);
      return true;
    },
  };
}

/** ディスパッチ結果。 */
export type WebhookOutcome =
  | { status: "processed"; type: string }
  | { status: "duplicate"; eventId: string }
  | { status: "invalid_signature" }
  | { status: "unhandled"; type: string };

/** イベントハンドラ(type ごと)。 */
export type WebhookHandler<E> = (event: E) => Promise<void> | void;

/** {@link createWebhookReceiver} のオプション。 */
export interface WebhookReceiverOptions<E> {
  secret: string;
  /** 署名ヘッダの接頭辞(例 "sha256=")。 */
  signaturePrefix?: string;
  algorithm?: string;
  /** 生ボディからイベントを取り出す(パース)。 */
  parse: (payload: string) => E;
  /** イベントから一意な ID を取り出す(冪等キー)。 */
  eventId: (event: E) => string;
  /** イベントから種別を取り出す(ディスパッチ用)。 */
  eventType: (event: E) => string;
  /** 冪等ストア(省略時はメモリ)。 */
  store?: WebhookIdempotencyStore;
}

/** Webhook レシーバ。 */
export interface WebhookReceiver<E> {
  /** type ごとのハンドラを登録する。 */
  on(type: string, handler: WebhookHandler<E>): this;
  /** 受信処理: 署名検証 → 冪等 → ディスパッチ。 */
  handle(payload: string, signature: string): Promise<WebhookOutcome>;
}

/**
 * Webhook レシーバを作る。
 * @example
 * ```ts
 * const receiver = createWebhookReceiver({
 *   secret: env.WEBHOOK_SECRET, signaturePrefix: "sha256=",
 *   parse: JSON.parse, eventId: (e) => e.id, eventType: (e) => e.type,
 * });
 * receiver.on("payment.succeeded", async (e) => { await markPaid(e); });
 * const result = await receiver.handle(rawBody, req.headers["x-signature"]);
 * ```
 *
 * @param options.secret 共有シークレット
 * @param options.onEvent イベントを受け取ったときの処理
 * @returns 受信器。**署名を検証してから onEvent を呼ぶ**
 */
export function createWebhookReceiver<E>(options: WebhookReceiverOptions<E>): WebhookReceiver<E> {
  const store = options.store ?? createMemoryWebhookStore();
  const handlers = new Map<string, WebhookHandler<E>>();

  return {
    on(type, handler) {
      handlers.set(type, handler);
      return this;
    },
    async handle(payload, signature) {
      // 1) 署名検証
      const valid = verifyHmacSignature({
        payload, signature, secret: options.secret,
        algorithm: options.algorithm, prefix: options.signaturePrefix ?? "",
      });
      if (!valid) return { status: "invalid_signature" };

      const event = options.parse(payload);
      const id = options.eventId(event);
      const type = options.eventType(event);

      // 2) 冪等(重複配送を1回に)
      const fresh = await store.reserve(id);
      if (!fresh) return { status: "duplicate", eventId: id };

      // 3) ディスパッチ
      const handler = handlers.get(type);
      if (!handler) return { status: "unhandled", type };
      await handler(event);
      return { status: "processed", type };
    },
  };
}
