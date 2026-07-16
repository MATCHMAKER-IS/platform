/**
 * 配信停止(unsubscribe)の管理。
 * 改ざん不可な署名トークンで配信停止リンクを生成・検証し、RFC 8058 のワンクリック配信停止
 * (List-Unsubscribe / List-Unsubscribe-Post ヘッダ)にも対応する。
 * 純ロジック(トークンは node:crypto の HMAC)。
 * @packageDocumentation
 */
import { createHmac, timingSafeEqual } from "node:crypto";

/** base64url エンコード。 */
function b64url(input: string): string {
  return Buffer.from(input, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
/** base64url デコード。 */
function b64urlDecode(input: string): string {
  return Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}
function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * 配信停止トークンを生成する。email(と任意のカテゴリ)を署名して埋め込む。
 * カテゴリを分ければ「特定の配信種別だけ停止」も表現できる。
 *
 * @param email メールアドレス
 * @param category カテゴリ
 * @param secret 署名鍵
 * @returns トークン(**署名付き**なので改ざんできない)
 */
export function createUnsubscribeToken(email: string, secret: string, options?: { category?: string }): string {
  const payload = JSON.stringify({ e: email.toLowerCase(), c: options?.category ?? null });
  const body = b64url(payload);
  return `${body}.${sign(body, secret)}`;
}

/** 配信停止トークンの検証結果。 */
export interface UnsubscribeVerification {
  valid: boolean;
  email?: string;
  category?: string | null;
}

/**
 * 配信停止トークンを検証する。
 *
 * **署名で改ざんを防ぐ**(トークンを書き換えて他人を配信停止にできないように)。
 *
 * @param token トークン
 * @param secret 署名鍵
 * @returns メールアドレスとカテゴリ。**不正なら null**
 */
export function verifyUnsubscribeToken(token: string, secret: string): UnsubscribeVerification {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return { valid: false };
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = sign(body, secret);
  if (sig.length !== expected.length) return { valid: false };
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return { valid: false };
    const payload = JSON.parse(b64urlDecode(body)) as { e: string; c: string | null };
    return { valid: true, email: payload.e, category: payload.c };
  } catch {
    return { valid: false };
  }
}

/**
 * 配信停止 URL を組み立てる。
 *
 * **メールに必ず入れる**(特定電子メール法で義務)。ワンクリックで停止できることが望ましい
 * (ログインを求めると、実質的に停止できない)。
 *
 * @param baseUrl 配信停止ページの URL
 * @param email メールアドレス
 * @param category カテゴリ
 * @param secret 署名鍵
 * @returns 配信停止 URL
 */
export function unsubscribeUrl(baseUrl: string, email: string, secret: string, options?: { category?: string; param?: string }): string {
  const token = createUnsubscribeToken(email, secret, options);
  const param = options?.param ?? "token";
  const sep = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${sep}${param}=${encodeURIComponent(token)}`;
}

/**
 * List-Unsubscribe / List-Unsubscribe-Post ヘッダを組み立てる(RFC 2369 / 8058)。
 * mailto と URL を併記でき、oneClick=true でワンクリック配信停止(POST)に対応する。
 *
 * @param url 配信停止 URL
 * @returns `List-Unsubscribe` ヘッダ(**メーラーが『配信停止』ボタンを出す**。本文のリンクより気づかれやすく、
 *   迷惑メール報告を減らせる)
 */
export function listUnsubscribeHeaders(options: { url?: string; mailto?: string; oneClick?: boolean }): Record<string, string> {
  const parts: string[] = [];
  if (options.url) parts.push(`<${options.url}>`);
  if (options.mailto) parts.push(`<mailto:${options.mailto}>`);
  const headers: Record<string, string> = {};
  if (parts.length > 0) headers["List-Unsubscribe"] = parts.join(", ");
  if (options.oneClick && options.url) headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  return headers;
}

/**
 * 配信停止済みかを判定する。
 *
 * @param email メールアドレス
 * @param category カテゴリ
 * @param unsubscribed 停止リスト
 * @returns 停止済みなら true(**カテゴリ単位で停止できる**。全部止めるか、
 *   お知らせだけ止めるかを選べる)
 */
export function isSuppressed(email: string, suppressed: ReadonlySet<string>): boolean {
  return suppressed.has(email.toLowerCase());
}

/**
 * 配信停止済みを除外する。
 *
 * **送信の前に必ず通す**(停止したのに届くと、法令違反であり信頼も失う)。
 *
 * @param emails 宛先の配列
 * @param category カテゴリ
 * @param unsubscribed 停止リスト
 * @returns 送ってよい宛先
 */
export function removeSuppressed(emails: string[], suppressed: ReadonlySet<string>): { sendable: string[]; suppressed: string[] } {
  const sendable: string[] = [];
  const removed: string[] = [];
  for (const e of emails) (suppressed.has(e.toLowerCase()) ? removed : sendable).push(e);
  return { sendable, suppressed: removed };
}
