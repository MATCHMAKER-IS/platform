/**
 * LINE Webhook の署名検証とイベントパース。
 * LINE は `x-line-signature` に「本文の HMAC-SHA256 を base64 した値」を送る(hex ではない)。
 * 汎用の @platform/webhook は hex 前提のため、LINE 専用にここで検証する。
 * @packageDocumentation
 */
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * LINE Webhook の署名を検証する。
 * @param body    リクエストの生ボディ(パース前の文字列)
 * @param signature `x-line-signature` ヘッダ値(base64)
 * @param channelSecret チャネルシークレット
 */
export function verifyLineSignature(body: string, signature: string, channelSecret: string): boolean {
  const expected = createHmac("sha256", channelSecret).update(body).digest("base64");
  if (signature.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

/** イベント送信元(user/group/room)。 */
export interface LineEventSource {
  type: "user" | "group" | "room";
  userId?: string;
  groupId?: string;
  roomId?: string;
}

/** 受信イベントの共通部分。 */
export interface LineEventBase {
  type: string;
  timestamp: number;
  source: LineEventSource;
  /** message/postback 等で返信に使うトークン(follow など無い場合もある)。 */
  replyToken?: string;
}

/** メッセージ受信イベント。 */
export interface LineMessageEvent extends LineEventBase {
  type: "message";
  message: { id: string; type: string; text?: string; [key: string]: unknown };
}

/** ポストバックイベント(ボタン押下等)。 */
export interface LinePostbackEvent extends LineEventBase {
  type: "postback";
  postback: { data: string; params?: Record<string, string> };
}

/** フォロー/アンフォロー/参加/退出。 */
export interface LineSimpleEvent extends LineEventBase {
  type: "follow" | "unfollow" | "join" | "leave";
}

/** 受信イベントの判別可能ユニオン。 */
export type LineWebhookEvent = LineMessageEvent | LinePostbackEvent | LineSimpleEvent | LineEventBase;

/** Webhook ボディをパースしてイベント配列を返す。 */
export function parseLineWebhook(body: string): LineWebhookEvent[] {
  const parsed = JSON.parse(body) as { events?: LineWebhookEvent[] };
  return parsed.events ?? [];
}

/** postback の data(クエリ文字列形式)を key/value に分解する補助。 */
export function parsePostbackData(data: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of data.split("&")) {
    const idx = pair.indexOf("=");
    if (idx === -1) { if (pair) out[pair] = ""; continue; }
    out[decodeURIComponent(pair.slice(0, idx))] = decodeURIComponent(pair.slice(idx + 1));
  }
  return out;
}

/** イベントのソースから宛先 ID(返信先ではなく push 先)を取り出す。 */
export function eventSourceId(source: LineEventSource): string | undefined {
  return source.userId ?? source.groupId ?? source.roomId;
}
