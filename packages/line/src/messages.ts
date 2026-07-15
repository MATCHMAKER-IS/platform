/**
 * LINE メッセージビルダー(純関数)。Flex・テンプレート(ボタン/確認/カルーセル)・
 * クイックリプライを手書き JSON なしで組み立てる。生成物はそのまま push/reply に渡せる。
 * @packageDocumentation
 */
import type { LineMessage } from "./index.js";

/** テキストメッセージ。 */
export function textMessage(text: string): LineMessage {
  return { type: "text", text };
}

/** スタンプメッセージ。 */
export function stickerMessage(packageId: string, stickerId: string): LineMessage {
  return { type: "sticker", packageId, stickerId };
}

/** 画像メッセージ(originalContentUrl は HTTPS 必須)。 */
export function imageMessage(originalContentUrl: string, previewImageUrl?: string): LineMessage {
  return { type: "image", originalContentUrl, previewImageUrl: previewImageUrl ?? originalContentUrl };
}

/** 位置情報メッセージ。 */
export function locationMessage(params: { title: string; address: string; latitude: number; longitude: number }): LineMessage {
  return { type: "location", ...params };
}

// ─────────────────────────── アクション ───────────────────────────

/** ボタン等のアクション。 */
export type LineAction =
  | { type: "message"; label: string; text: string }
  | { type: "postback"; label: string; data: string; displayText?: string }
  | { type: "uri"; label: string; uri: string }
  | { type: "datetimepicker"; label: string; data: string; mode: "date" | "time" | "datetime" };

/** メッセージ送信アクション。 */
export function messageAction(label: string, text: string): LineAction {
  return { type: "message", label, text };
}
/** ポストバックアクション(webhook で data を受け取る)。 */
export function postbackAction(label: string, data: string, displayText?: string): LineAction {
  return { type: "postback", label, data, ...(displayText ? { displayText } : {}) };
}
/** URI アクション(リンク遷移)。 */
export function uriAction(label: string, uri: string): LineAction {
  return { type: "uri", label, uri };
}

// ─────────────────────────── クイックリプライ ───────────────────────────

/** メッセージにクイックリプライ(候補ボタン)を付ける。 */
export function withQuickReply(message: LineMessage, actions: LineAction[]): LineMessage {
  return { ...message, quickReply: { items: actions.map((action) => ({ type: "action", action })) } };
}

// ─────────────────────────── テンプレートメッセージ ───────────────────────────

/** ボタンテンプレート(タイトル・本文・ボタン群)。 */
export function buttonsTemplate(params: { altText: string; title?: string; text: string; actions: LineAction[]; thumbnailImageUrl?: string }): LineMessage {
  return {
    type: "template",
    altText: params.altText,
    template: {
      type: "buttons",
      ...(params.thumbnailImageUrl ? { thumbnailImageUrl: params.thumbnailImageUrl } : {}),
      ...(params.title ? { title: params.title } : {}),
      text: params.text,
      actions: params.actions,
    },
  };
}

/** 確認テンプレート(はい/いいえ の2択)。 */
export function confirmTemplate(altText: string, text: string, yes: LineAction, no: LineAction): LineMessage {
  return { type: "template", altText, template: { type: "confirm", text, actions: [yes, no] } };
}

/** カルーセルの1カラム。 */
export interface CarouselColumn {
  title?: string;
  text: string;
  thumbnailImageUrl?: string;
  actions: LineAction[];
}

/** カルーセルテンプレート(横スクロールカード)。 */
export function carouselTemplate(altText: string, columns: CarouselColumn[]): LineMessage {
  return {
    type: "template",
    altText,
    template: { type: "carousel", columns: columns.map((c) => ({ ...(c.thumbnailImageUrl ? { thumbnailImageUrl: c.thumbnailImageUrl } : {}), ...(c.title ? { title: c.title } : {}), text: c.text, actions: c.actions })) },
  };
}

/** Flex メッセージ(bubble/carousel の contents をそのまま渡す)。 */
export function flexMessage(altText: string, contents: Record<string, unknown>): LineMessage {
  return { type: "flex", altText, contents };
}
