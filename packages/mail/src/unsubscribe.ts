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

/** 配信停止トークンを検証し、正当なら email/category を取り出す。 */
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

/** 配信停止 URL を組み立てる(トークンをクエリに付与)。 */
export function unsubscribeUrl(baseUrl: string, email: string, secret: string, options?: { category?: string; param?: string }): string {
  const token = createUnsubscribeToken(email, secret, options);
  const param = options?.param ?? "token";
  const sep = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${sep}${param}=${encodeURIComponent(token)}`;
}

/**
 * List-Unsubscribe / List-Unsubscribe-Post ヘッダを組み立てる(RFC 2369 / 8058)。
 * mailto と URL を併記でき、oneClick=true でワンクリック配信停止(POST)に対応する。
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

/** 配信停止済みかを判定する(呼び出し側が保持する停止リストの Set に対して)。 */
export function isSuppressed(email: string, suppressed: ReadonlySet<string>): boolean {
  return suppressed.has(email.toLowerCase());
}

/** 宛先リストから配信停止済みを除外する。 */
export function removeSuppressed(emails: string[], suppressed: ReadonlySet<string>): { sendable: string[]; suppressed: string[] } {
  const sendable: string[] = [];
  const removed: string[] = [];
  for (const e of emails) (suppressed.has(e.toLowerCase()) ? removed : sendable).push(e);
  return { sendable, suppressed: removed };
}
