/**
 * LINE メッセージビルダー(純関数)。Flex・テンプレート(ボタン/確認/カルーセル)・
 * クイックリプライを手書き JSON なしで組み立てる。生成物はそのまま push/reply に渡せる。
 * @packageDocumentation
 */
import type { LineMessage } from "./index";

/**
 * テキストメッセージを作る。
 *
 * **5000 文字まで**(超えると API がエラーを返す)。
 *
 * @param text 本文
 * @returns メッセージ
 */
export function textMessage(text: string): LineMessage {
  return { type: "text", text };
}

/**
 * スタンプメッセージを作る。
 *
 * @param packageId スタンプパッケージ
 * @param stickerId スタンプ
 * @returns メッセージ
 */
export function stickerMessage(packageId: string, stickerId: string): LineMessage {
  return { type: "sticker", packageId, stickerId };
}

/**
 * 画像メッセージを作る。
 *
 * **HTTPS 必須**(HTTP の URL は LINE 側で拒否される)。
 * プレビュー画像も要る(一覧に出すため)。
 *
 * @param originalContentUrl 元画像の URL(**HTTPS**)
 * @param previewImageUrl プレビュー画像の URL
 * @returns メッセージ
 */
export function imageMessage(originalContentUrl: string, previewImageUrl?: string): LineMessage {
  return { type: "image", originalContentUrl, previewImageUrl: previewImageUrl ?? originalContentUrl };
}

/**
 * 位置情報メッセージを作る。
 *
 * @param options.title / address / latitude / longitude 位置の情報
 * @returns メッセージ
 */
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

/**
 * メッセージ送信アクションを作る(ボタンを押すと発言する)。
 *
 * @param label ボタンの表示
 * @param text 送信するテキスト
 * @returns アクション
 */
export function messageAction(label: string, text: string): LineAction {
  return { type: "message", label, text };
}
/**
 * ポストバックアクションを作る。
 *
 * **利用者の発言として残らない**(webhook で `data` を受け取るだけ)。
 * 「はい/いいえ」の選択など、トーク画面に残したくない操作に使う。
 *
 * @param label ボタンの表示
 * @param data webhook で受け取るデータ(**クエリ文字列形式が扱いやすい**)
 * @param displayText トークに表示するテキスト(任意)
 * @returns アクション
 */
export function postbackAction(label: string, data: string, displayText?: string): LineAction {
  return { type: "postback", label, data, ...(displayText ? { displayText } : {}) };
}
/**
 * URI アクション(リンク遷移)。
 *
 *
 * @param label ボタンの表示
 * @param uri 開く URL(**HTTPS 必須**)
 * @returns アクション
 */
export function uriAction(label: string, uri: string): LineAction {
  return { type: "uri", label, uri };
}

// ─────────────────────────── クイックリプライ ───────────────────────────

/**
 * メッセージにクイックリプライ(候補ボタン)を付ける。
 *
 *
 * @param message 元のメッセージ
 * @param items クイックリプライの項目(**最大 13 件**)
 * @returns クイックリプライ付きのメッセージ(**トーク下部にボタンが並ぶ**。選択肢を示すと会話が進みやすい)
 */
export function withQuickReply(message: LineMessage, actions: LineAction[]): LineMessage {
  return { ...message, quickReply: { items: actions.map((action) => ({ type: "action", action })) } };
}

// ─────────────────────────── テンプレートメッセージ ───────────────────────────

/**
 * ボタンテンプレート(タイトル・本文・ボタン群)。
 *
 *
 * @param options.title / text / actions 表示内容
 * @returns テンプレートメッセージ(**アクションは最大 4 件**)
 */
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

/**
 * 確認テンプレート(はい/いいえ の2択)。
 *
 *
 * @param text 確認する文言
 * @param actions アクション(**ちょうど 2 件**。はい/いいえ の 2 択専用)
 * @returns テンプレートメッセージ
 */
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

/**
 * カルーセルテンプレート(横スクロールカード)。
 *
 *
 * @param columns カラム(**最大 10 件**。横スクロールで選ばせる)
 * @returns テンプレートメッセージ
 */
export function carouselTemplate(altText: string, columns: CarouselColumn[]): LineMessage {
  return {
    type: "template",
    altText,
    template: { type: "carousel", columns: columns.map((c) => ({ ...(c.thumbnailImageUrl ? { thumbnailImageUrl: c.thumbnailImageUrl } : {}), ...(c.title ? { title: c.title } : {}), text: c.text, actions: c.actions })) },
  };
}

/**
 * Flex メッセージ(bubble/carousel の contents をそのまま渡す)。
 *
 *
 * @param altText 通知やトーク一覧に出る代替テキスト(**必須**。これが無いと何の通知か分からない)
 * @param contents レイアウト定義
 * @returns Flex メッセージ(**自由なレイアウトを組める**が、定義が複雑)
 */
export function flexMessage(altText: string, contents: Record<string, unknown>): LineMessage {
  return { type: "flex", altText, contents };
}
