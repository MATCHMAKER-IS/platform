/**
 * Gmail API クライアント。メール送信(RFC822 を base64url でエンコード)・一覧・取得・ラベル。
 * OAuth アクセストークン(scope: gmail.send / gmail.readonly 等)で認証する。
 * @packageDocumentation
 */
import { createApiClient } from "@platform/integrations";
import type { Result } from "@platform/core";

/** 送信メールの入力。 */
export interface GmailMessageInput {
  to: string | string[];
  subject: string;
  /** 本文(text/plain)。html を指定した場合はそちらが優先。 */
  text?: string;
  html?: string;
  cc?: string | string[];
  bcc?: string | string[];
  from?: string;
  replyTo?: string;
}

/** base64url エンコード(パディング除去)。 */
function toBase64Url(input: string): string {
  const b64 = typeof Buffer !== "undefined"
    ? Buffer.from(input, "utf-8").toString("base64")
    : btoa(unescape(encodeURIComponent(input)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** 件名を MIME エンコード(日本語対応・RFC2047 の base64)。 */
function encodeHeader(value: string): string {
  // ASCII のみならそのまま
  if (/^[\x20-\x7E]*$/.test(value)) return value;
  const b64 = typeof Buffer !== "undefined" ? Buffer.from(value, "utf-8").toString("base64") : btoa(unescape(encodeURIComponent(value)));
  return `=?UTF-8?B?${b64}?=`;
}

/**
 * GmailMessageInput から RFC822 の生メールを組み立てる。
 *
 *
 * @param message 宛先・件名・本文
 * @returns RFC 2822 形式を base64url にした文字列(**Gmail API はこの形式を要求する**)
 */
export function buildRawEmail(msg: GmailMessageInput): string {
  const list = (v: string | string[]) => (Array.isArray(v) ? v.join(", ") : v);
  const headers: string[] = [];
  if (msg.from) headers.push(`From: ${msg.from}`);
  headers.push(`To: ${list(msg.to)}`);
  if (msg.cc) headers.push(`Cc: ${list(msg.cc)}`);
  if (msg.bcc) headers.push(`Bcc: ${list(msg.bcc)}`);
  if (msg.replyTo) headers.push(`Reply-To: ${msg.replyTo}`);
  headers.push(`Subject: ${encodeHeader(msg.subject)}`);
  headers.push("MIME-Version: 1.0");
  const isHtml = msg.html !== undefined;
  headers.push(`Content-Type: ${isHtml ? "text/html" : "text/plain"}; charset=UTF-8`);
  headers.push("Content-Transfer-Encoding: base64");
  const body = isHtml ? msg.html! : (msg.text ?? "");
  const encodedBody = typeof Buffer !== "undefined" ? Buffer.from(body, "utf-8").toString("base64") : btoa(unescape(encodeURIComponent(body)));
  return headers.join("\r\n") + "\r\n\r\n" + encodedBody;
}

/** Gmail クライアント。 */
export interface GmailClient {
  /** メールを送信する。 */
  sendEmail(msg: GmailMessageInput): Promise<Result<unknown>>;
  /** 事前構築した RFC822 raw を送信する(添付など高度な用途)。 */
  sendRaw(raw: string): Promise<Result<unknown>>;
  /** メッセージ一覧(検索クエリ q は Gmail の検索構文)。 */
  listMessages(params?: { q?: string; maxResults?: number; labelIds?: string[] }): Promise<Result<{ messages?: { id: string }[] }>>;
  /** メッセージ詳細。 */
  getMessage(messageId: string, format?: "full" | "metadata" | "minimal"): Promise<Result<unknown>>;
  /** ラベル一覧。 */
  listLabels(): Promise<Result<{ labels?: unknown[] }>>;
}

/**
 * Gmail クライアントを作る。
 * @param config `accessToken`(scope: gmail.send 等)/ `fetchImpl`(認証付き fetch 注入可)
 * @returns Gmail クライアント
 */
export function createGmailClient(config: { accessToken: string; fetchImpl?: typeof fetch }): GmailClient {
  const api = createApiClient({
    baseUrl: "https://gmail.googleapis.com/gmail/v1/users/me",
    headers: { Authorization: `Bearer ${config.accessToken}` },
    fetchImpl: config.fetchImpl,
  });
  return {
    sendEmail: (msg) => api.post("/messages/send", { body: { raw: toBase64Url(buildRawEmail(msg)) } }),
    sendRaw: (raw) => api.post("/messages/send", { body: { raw: toBase64Url(raw) } }),
    // labelIds は string[] だが、共通クライアントの query は string|number|boolean しか受けない。
    // Gmail API はカンマ区切りも解釈するので、ここで畳んで渡す(配列のまま渡すと TS2322)。
    listMessages: (params) => api.get<{ messages?: { id: string }[] }>("/messages", {
      query: {
        q: params?.q,
        maxResults: params?.maxResults,
        labelIds: params?.labelIds && params.labelIds.length > 0 ? params.labelIds.join(",") : undefined,
      },
    }),
    getMessage: (messageId, format = "full") => api.get(`/messages/${messageId}`, { query: { format } }),
    listLabels: () => api.get<{ labels?: unknown[] }>("/labels"),
  };
}
