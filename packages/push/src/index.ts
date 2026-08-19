/**
 * `@platform/push` — Web Push(ブラウザへのプッシュ通知)。
 *
 * 【なぜ要るか】
 * 業務の通知はメールと Slack で足りることが多いが、**すぐ気づいてほしいもの**
 * には弱い——メールは埋もれ、Slack は業務時間外に見ない。
 * 承認待ち・障害・当日の予定変更のように、**開いていなくても届く**必要がある
 * ものにプッシュ通知を使う。
 *
 * 【なぜ自前で書くか】
 * `web-push` パッケージは依存が多く、**このパッケージだけで 30 以上**入る。
 * Web Push が要るのは VAPID の署名と本文の暗号化だけで、
 * どちらも **Node の `crypto` で足りる**(P-256 / HKDF / AES-128-GCM)。
 * 依存ゼロを保てるなら、その方が保守が楽になる。
 *
 * 【何を扱わないか】
 * - **Service Worker の登録**(ブラウザ側の仕事。`@platform/mobile` の PWA を使う)
 * - **購読の保存先**(アプリが DB に持つ。ここは `PushSubscription` の形だけ決める)
 * - **iOS の制約**(PWA としてホーム画面に追加しないと届かない。案内は画面側で)
 *
 * @packageDocumentation
 */
import { createECDH, createCipheriv, createSign, randomBytes, hkdfSync, createPrivateKey } from "node:crypto";

/** 送信先の購読情報(ブラウザの `PushSubscription` をそのまま保存した形)。 */
export interface PushSubscription {
  /** 送信先の URL(ブラウザベンダーのサーバ)。 */
  endpoint: string;
  /** 暗号鍵。 */
  keys: {
    /** 受信者の公開鍵(Base64URL)。 */
    p256dh: string;
    /** 認証秘密(Base64URL)。 */
    auth: string;
  };
  /** 期限(ミリ秒。ブラウザが返さないこともある)。 */
  expirationTime?: number | null;
}

/** VAPID の鍵ペア。 */
export interface VapidKeys {
  /** 公開鍵(Base64URL)。**ブラウザ側の購読時に渡す**。 */
  publicKey: string;
  /** 秘密鍵(Base64URL)。**サーバだけが持つ**。 */
  privateKey: string;
  /**
   * 連絡先(`mailto:` か `https:`)。
   *
   * **必須。** 送信に問題があったとき、ブラウザベンダーがここへ連絡する。
   * 省くと拒否されることがある。
   */
  subject: string;
}

/** 通知の中身。 */
export interface PushMessage {
  /** 見出し。 */
  title: string;
  /** 本文。 */
  body?: string;
  /** 押したときに開く URL。 */
  url?: string;
  /**
   * まとめる目印。
   *
   * **同じ tag の通知は上書きされる**——「未読 3 件」を何度も出すより、
   * 最新の 1 件だけ見せる方がよい。
   */
  tag?: string;
  /** アイコンの URL。 */
  icon?: string;
  /** 追加のデータ(Service Worker が読む)。 */
  data?: Record<string, unknown>;
}

/** 送信の結果。 */
export interface PushResult {
  /** 送れたか。 */
  ok: boolean;
  /** HTTP ステータス。 */
  status: number;
  /**
   * **購読が無効になったか**(404 / 410)。
   *
   * `true` なら**保存先から消すこと**——ブラウザを消した・通知を切った
   * 場合に返る。消さないと、**毎回送っては失敗するだけ**の購読が溜まる。
   */
  gone: boolean;
  /** 失敗の理由(ログ用)。 */
  error?: string;
}

/** Base64URL に変換する。 */
function toBase64Url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Base64URL から戻す。 */
function fromBase64Url(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

/**
 * VAPID の鍵ペアを作る。
 *
 * **一度作ったら変えない。** 変えると**既存の購読がすべて無効**になり、
 * 全員に登録し直してもらうことになる——利用者は「通知が来なくなった」
 * としか分からず、原因にたどり着けない。
 *
 * 秘密鍵は**環境変数に置く**(コードに直書きしない)。
 *
 * @param subject 連絡先(`mailto:ops@example.co.jp` など)
 * @returns 公開鍵・秘密鍵・連絡先
 *
 * @example
 * ```ts
 * const keys = generateVapidKeys("mailto:ops@example.co.jp");
 * // publicKey をブラウザ側の購読処理へ、privateKey を環境変数へ
 * ```
 */
export function generateVapidKeys(subject: string): VapidKeys {
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  return {
    publicKey: toBase64Url(ecdh.getPublicKey()),
    privateKey: toBase64Url(ecdh.getPrivateKey()),
    subject,
  };
}

/** DER 署名(ASN.1)を r||s の生の形に直す。 */
function derToRaw(der: Buffer): Buffer {
  // SEQUENCE(0x30) len INTEGER(0x02) len r INTEGER(0x02) len s
  let offset = der[1] === 0x81 ? 3 : 2;
  const rLen = der[offset + 1] ?? 0;
  let r = der.subarray(offset + 2, offset + 2 + rLen);
  offset += 2 + rLen;
  const sLen = der[offset + 1] ?? 0;
  let s = der.subarray(offset + 2, offset + 2 + sLen);
  // **先頭の 0x00 を落とし、32 バイトに揃える**(ASN.1 は符号ビットを避けるため
  // 先頭に 0 を足すことがある。JWT は固定長を求める)
  if (r.length > 32) r = r.subarray(r.length - 32);
  if (s.length > 32) s = s.subarray(s.length - 32);
  return Buffer.concat([
    Buffer.alloc(32 - r.length), r,
    Buffer.alloc(32 - s.length), s,
  ]);
}

/** 秘密鍵(Base64URL の生バイト)から PKCS#8 の鍵オブジェクトを作る。 */
function toPrivateKeyObject(privateKeyB64: string, publicKeyB64: string) {
  const d = fromBase64Url(privateKeyB64);
  const q = fromBase64Url(publicKeyB64);
  // **PKCS#8 を手で組み立てる。** Node は生の 32 バイトを直接受け取れない。
  // 固定のヘッダ(P-256 の OID を含む)に鍵を差し込む
  const der = Buffer.concat([
    Buffer.from("308187020100301306072a8648ce3d020106082a8648ce3d030107046d306b0201010420", "hex"),
    d,
    Buffer.from("a144034200", "hex"),
    q,
  ]);
  return createPrivateKey({ key: der, format: "der", type: "pkcs8" });
}

/**
 * VAPID の認証ヘッダを作る。
 *
 * **送信先のドメインごとに作る**(`aud` が違うため)。
 * 有効期限は 12 時間——長すぎると盗まれたときの影響が大きく、
 * 短すぎると時計のずれで弾かれる。
 *
 * @param endpoint 送信先の URL
 * @param keys VAPID の鍵
 * @param now 現在時刻(テスト注入用)
 * @returns `Authorization` ヘッダの値
 */
export function buildVapidHeader(endpoint: string, keys: VapidKeys, now: Date = new Date()): string {
  const aud = new URL(endpoint).origin;
  const header = toBase64Url(Buffer.from(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const payload = toBase64Url(Buffer.from(JSON.stringify({
    aud,
    exp: Math.floor(now.getTime() / 1000) + 12 * 60 * 60,
    sub: keys.subject,
  })));
  const signer = createSign("SHA256");
  signer.update(`${header}.${payload}`);
  const der = signer.sign(toPrivateKeyObject(keys.privateKey, keys.publicKey));
  const jwt = `${header}.${payload}.${toBase64Url(derToRaw(der))}`;
  return `vapid t=${jwt}, k=${keys.publicKey}`;
}

/**
 * 本文を暗号化する(RFC 8291 の aes128gcm)。
 *
 * **中身はブラウザベンダーのサーバを通る**ので、暗号化しないと読まれる。
 * 承認の内容や取引先名が含まれることがあるため、必須。
 *
 * @param payload 送る本文(JSON 文字列)
 * @param subscription 送信先の購読情報
 * @param salt 塩(テスト注入用。省略時はランダム)
 * @param localKeys 一時鍵(テスト注入用。省略時は毎回新しく作る)
 * @returns 暗号化した本文
 */
export function encryptPayload(
  payload: string,
  subscription: PushSubscription,
  salt: Buffer = randomBytes(16),
  localKeys?: { publicKey: Buffer; privateKey: Buffer },
): Buffer {
  const clientPublic = fromBase64Url(subscription.keys.p256dh);
  const authSecret = fromBase64Url(subscription.keys.auth);

  // **送るたびに新しい鍵を作る**(使い回すと過去の通知も復号されうる)
  const ecdh = createECDH("prime256v1");
  if (localKeys) ecdh.setPrivateKey(localKeys.privateKey);
  else ecdh.generateKeys();
  const localPublic = localKeys?.publicKey ?? ecdh.getPublicKey();
  const sharedSecret = ecdh.computeSecret(clientPublic);

  // **鍵の導出は仕様どおりの順序で**(1 つでも違うと復号できない)
  const prkKey = Buffer.from(hkdfSync("sha256", sharedSecret, authSecret,
    Buffer.from("WebPush: info\0"), 32));
  const keyInfoBase = Buffer.concat([clientPublic, localPublic]);
  const ikm = Buffer.from(hkdfSync("sha256", sharedSecret, authSecret,
    Buffer.concat([Buffer.from("WebPush: info\0"), keyInfoBase]), 32));
  void prkKey;

  const cek = Buffer.from(hkdfSync("sha256", ikm, salt,
    Buffer.from("Content-Encoding: aes128gcm\0"), 16));
  const nonce = Buffer.from(hkdfSync("sha256", ikm, salt,
    Buffer.from("Content-Encoding: nonce\0"), 12));

  // **パディング区切り(0x02)を末尾に足す**(仕様。付け忘れると復号側が弾く)
  const cipher = createCipheriv("aes-128-gcm", cek, nonce);
  const body = Buffer.concat([
    cipher.update(Buffer.concat([Buffer.from(payload, "utf8"), Buffer.from([0x02])])),
    cipher.final(),
    cipher.getAuthTag(),
  ]);

  // ヘッダ: salt(16) + レコード長(4) + 鍵長(1) + 一時公開鍵(65)
  const header = Buffer.alloc(21);
  salt.copy(header, 0);
  header.writeUInt32BE(4096, 16);
  header.writeUInt8(localPublic.length, 20);
  return Buffer.concat([header, localPublic, body]);
}

/** {@link sendPush} の設定。 */
export interface SendPushOptions {
  /** VAPID の鍵。 */
  vapid: VapidKeys;
  /**
   * 通知を保持する秒数(既定 86,400 = 1 日)。
   *
   * **端末がオフラインの間、送信先が預かる時間**。
   * 短いと寝ている間の通知が消え、長いと**古い情報が後から届く**
   * ——「本日 10 時から会議」が翌日に届いても意味がない。
   */
  ttlSeconds?: number;
  /**
   * 緊急度。
   *
   * `low` は**端末が省電力のとき後回し**にされる。
   * 承認待ちのような「早く見てほしいが緊急ではない」ものは `normal`。
   */
  urgency?: "very-low" | "low" | "normal" | "high";
  /** fetch の実装(テスト注入用)。 */
  fetchImpl?: typeof fetch;
  /** 現在時刻(テスト注入用)。 */
  now?: Date;
}

/**
 * プッシュ通知を 1 件送る。
 *
 * **失敗しても例外を投げない。** 送信先が消えている(404 / 410)のは
 * 異常ではなく**日常的に起きる**——ブラウザを消した、通知を切った。
 * 例外にすると、一斉送信の途中で止まってしまう。
 *
 * **`gone` が `true` なら購読を消すこと**。消さないと、
 * **毎回送っては失敗するだけ**の購読が溜まり続ける。
 *
 * @param subscription 送信先
 * @param message 通知の中身
 * @param options VAPID の鍵と送信の設定
 * @returns 送信の結果(**例外は投げない**)
 *
 * @example
 * ```ts
 * const r = await sendPush(sub, { title: "承認待ち", body: "経費 3 件", url: "/approvals" }, { vapid });
 * if (r.gone) await store.remove(sub.endpoint);   // **消さないと溜まる**
 * ```
 */
export async function sendPush(
  subscription: PushSubscription,
  message: PushMessage,
  options: SendPushOptions,
): Promise<PushResult> {
  const doFetch = options.fetchImpl ?? fetch;
  const body = encryptPayload(JSON.stringify(message), subscription);
  try {
    const res = await doFetch(subscription.endpoint, {
      method: "POST",
      headers: {
        Authorization: buildVapidHeader(subscription.endpoint, options.vapid, options.now),
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        TTL: String(options.ttlSeconds ?? 86_400),
        Urgency: options.urgency ?? "normal",
      },
      body: new Uint8Array(body),
    });
    return {
      ok: res.ok,
      status: res.status,
      // **404 / 410 は「もう届かない」**(異常ではない)
      gone: res.status === 404 || res.status === 410,
      error: res.ok ? undefined : `HTTP ${res.status}`,
    };
  } catch (e) {
    // **ネットワークの失敗は再試行の対象**(`gone` にはしない)
    return { ok: false, status: 0, gone: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** 一斉送信の結果。 */
export interface BroadcastResult {
  /** 送れた数。 */
  sent: number;
  /** 失敗した数。 */
  failed: number;
  /** **消すべき購読の endpoint**(404 / 410 が返ったもの)。 */
  gone: string[];
}

/**
 * 複数の購読へ送る。
 *
 * **1 件ずつ順に送る。** 並列にすると送信先のレート制限に当たり、
 * **一部だけ届く**という分かりにくい状態になる。
 * 数百件なら順送りで十分速い(1 件あたり数十ミリ秒)。
 *
 * **失敗しても止まらない**——1 人の購読が切れていても、他の人には届く。
 *
 * @param subscriptions 送信先
 * @param message 通知の中身
 * @param options 送信の設定
 * @returns 送れた数・失敗した数・**消すべき購読**
 *
 * @example
 * ```ts
 * const r = await broadcastPush(subs, message, { vapid });
 * for (const endpoint of r.gone) await store.remove(endpoint);
 * ```
 */
export async function broadcastPush(
  subscriptions: readonly PushSubscription[],
  message: PushMessage,
  options: SendPushOptions,
): Promise<BroadcastResult> {
  const result: BroadcastResult = { sent: 0, failed: 0, gone: [] };
  for (const sub of subscriptions) {
    const r = await sendPush(sub, message, options);
    if (r.ok) result.sent += 1;
    else result.failed += 1;
    if (r.gone) result.gone.push(sub.endpoint);
  }
  return result;
}

/**
 * 購読が期限切れかを判定する。
 *
 * **`expirationTime` を返さないブラウザもある**(その場合は期限なし)。
 * 期限切れの購読に送っても届かないので、**送る前に外す**と無駄が減る。
 *
 * @param subscription 購読
 * @param now 現在時刻(テスト注入用)
 * @returns 期限切れなら true。**期限が無ければ false**
 */
export function isExpired(subscription: PushSubscription, now: Date = new Date()): boolean {
  const exp = subscription.expirationTime;
  if (exp === undefined || exp === null) return false;
  return exp <= now.getTime();
}

/**
 * 購読の形が妥当かを判定する。
 *
 * **保存する前に通す。** ブラウザから来た値をそのまま保存すると、
 * **鍵が欠けた購読**が混ざり、送信時に毎回落ちる。
 *
 * @param value 判定する値(ブラウザから来た未検証の値)
 * @returns 妥当なら true(型ガード)
 */
export function isValidSubscription(value: unknown): value is PushSubscription {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.endpoint !== "string" || v.endpoint === "") return false;
  // **`https:` だけを受ける**(`http:` の送信先は無い。混ざるなら細工を疑う)
  if (!v.endpoint.startsWith("https://")) return false;
  const keys = v.keys;
  if (typeof keys !== "object" || keys === null) return false;
  const k = keys as Record<string, unknown>;
  return typeof k.p256dh === "string" && k.p256dh !== ""
    && typeof k.auth === "string" && k.auth !== "";
}

/**
 * 通知チャネル(`@platform/notify`)として使える形にする。
 *
 * **他の経路(メール・Slack)と同じ扱い**にできるので、
 * 「どの経路で送るか」を設定で切り替えられる。
 *
 * @param loadSubscriptions 宛先の購読を取り出す関数(アプリが DB から引く)
 * @param onGone 無効になった購読を消す関数
 * @param options VAPID の鍵と送信の設定
 * @returns `send(message)` を持つチャネル
 */
export function createPushChannel(
  loadSubscriptions: () => Promise<readonly PushSubscription[]>,
  onGone: (endpoint: string) => Promise<void>,
  options: SendPushOptions,
): { send(message: { text: string; level?: string }): Promise<void> } {
  return {
    async send(message) {
      const subs = await loadSubscriptions();
      const r = await broadcastPush(subs, {
        title: message.level === "error" ? "エラー" : "お知らせ",
        body: message.text,
      }, options);
      // **無効な購読はその場で消す**(溜めると毎回失敗するだけ)
      for (const endpoint of r.gone) await onGone(endpoint);
    },
  };
}
