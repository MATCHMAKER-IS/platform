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
 * @param params.payload 受け取った本文(**パースする前の生の文字列**。整形すると署名が合わない)
 * @param params.signature 署名ヘッダの値
 * @param params.secret 共有シークレット
 * @returns 正当なら true
 */
/**
 * 署名に時刻を含めて検証する。
 *
 * 【なぜ要るか】
 * 署名だけだと、**過去の正しい要求をそのまま送り直せる**。
 * 「重複を弾く」記録は期限で消えるので、
 * その後に再送されると通ってしまう(24 時間後に同じ入金通知、など)。
 *
 * 送信側は `t=<epoch秒>,v1=<署名>` の形でヘッダを送り、
 * **署名の対象は `<epoch秒>.<本文>`** とする(Stripe などと同じ作法)。
 *
 * @param params 本文・ヘッダ・鍵・許容する時刻のずれ
 * @returns 検証の結果
 *
 * @example
 * ```ts
 * const r = verifySignedAt({
 *   payload: rawBody,
 *   header: req.headers.get("x-signature") ?? "",
 *   secret: env.WEBHOOK_SECRET,
 * });
 * if (!r.ok) return Response.json({ error: r.reason }, { status: 400 });
 * ```
 */
export function verifySignedAt(params: {
  /** 生ボディ(パース前)。 */
  payload: string;
  /** `t=...,v1=...` 形式のヘッダ値。 */
  header: string;
  /** 共有シークレット。 */
  secret: string;
  /**
   * 許容する時刻のずれ(秒。既定 300)。
   *
   * **短すぎると時計のずれで弾く。**
   * サーバ間で数分ずれることは珍しくない。
   */
  toleranceSec?: number;
  /** 現在時刻(テスト用)。 */
  now?: () => number;
}): { ok: true } | { ok: false; reason: "malformed" | "expired" | "invalid_signature" } {
  const { payload, header, secret, toleranceSec = 300, now = () => Date.now() } = params;

  const parts = new Map<string, string>();
  for (const kv of header.split(",")) {
    const i = kv.indexOf("=");
    if (i > 0) parts.set(kv.slice(0, i).trim(), kv.slice(i + 1).trim());
  }
  const t = Number(parts.get("t"));
  const v1 = parts.get("v1");
  if (!Number.isFinite(t) || v1 === undefined || v1 === "") return { ok: false, reason: "malformed" };

  // **未来も弾く。** 時計を進めた署名を先に作り置きされるのを防ぐ
  const diff = Math.abs(Math.floor(now() / 1000) - t);
  if (diff > toleranceSec) return { ok: false, reason: "expired" };

  // **署名の対象は「時刻 + 本文」。**
  // 時刻を署名に含めないと、時刻だけ書き換えられる
  const expected = createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
  if (v1.length !== expected.length) return { ok: false, reason: "invalid_signature" };
  try {
    const same = timingSafeEqual(Buffer.from(v1, "hex"), Buffer.from(expected, "hex"));
    return same ? { ok: true } : { ok: false, reason: "invalid_signature" };
  } catch {
    return { ok: false, reason: "invalid_signature" };
  }
}

/**
 * HMAC 署名を検証する。
 *
 * **比較は時間一定で行う**(`timingSafeEqual`)。素朴な `===` だと
 * 一致する文字数で応答時間が変わり、総当たりの手がかりになる。
 *
 * @param params `payload`(署名対象の生ボディ)・`signature`(受信した署名)・
 *   `secret`(検証鍵)をまとめて渡す。**個別の引数ではない**
 * @returns 一致すれば true
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
 * @param ttlMs 記録を保持する時間(ミリ秒)。**初期データではない**——
 *   2026-08 まで `seed` と説明しており、**配列を渡すつもりで数値の位置に
 *   入れると TTL が壊れる**(受信済みの判定ができなくなり、**同じ通知を二重に処理**する)
 * @param now 現在時刻(**テスト注入用**。渡さなければ `new Date()`)
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
 *   `eventId` は冪等キーの取り出し。**受信時の処理は `onEvent` ではなく、
 *   戻り値の受信器に登録する**
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
