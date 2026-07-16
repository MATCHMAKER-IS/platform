/**
 * チャットメッセージ(純ロジック)。作成・検証・整列・日付グループ化・メンション抽出。
 * @packageDocumentation
 */

import { type Attachment } from "./attachment";

/** チャットメッセージ。 */
export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  text: string;
  /** 送信日時(ISO)。 */
  at: string;
  /** 返信先メッセージ ID(スレッド返信)。 */
  replyTo?: string;
  /** 編集日時(編集済みなら設定)。 */
  editedAt?: string;
  /** 添付ファイル。 */
  attachments?: Attachment[];
}

/** メッセージ作成の入力。 */
export interface NewMessage {
  id: string;
  roomId: string;
  senderId: string;
  text: string;
  at?: string;
  replyTo?: string;
  attachments?: Attachment[];
}

/** メッセージ本文の上限(文字)。 */
export const MAX_MESSAGE_LENGTH = 4000;

/** 作成結果。 */
export type CreateMessageResult = { ok: true; message: ChatMessage } | { ok: false; error: string };

/**
 * メッセージを作成する。
 *
 * @param input 送信者・ルーム・本文など
 * @param now 現在時刻(テスト注入用)
 * @returns 作成したメッセージ
 * @throws {@link @platform/core#AppError} コード `VALIDATION` — 本文が空・空白のみ・長すぎる場合
 */
export function createMessage(input: NewMessage): CreateMessageResult {
  const text = input.text.trim();
  const attachments = input.attachments ?? [];
  if (text.length === 0 && attachments.length === 0) return { ok: false, error: "メッセージが空です" };
  if (text.length > MAX_MESSAGE_LENGTH) return { ok: false, error: `メッセージが長すぎます(最大${MAX_MESSAGE_LENGTH}文字)` };
  return {
    ok: true,
    message: { id: input.id, roomId: input.roomId, senderId: input.senderId, text, at: input.at ?? new Date().toISOString(), ...(input.replyTo ? { replyTo: input.replyTo } : {}), ...(attachments.length > 0 ? { attachments } : {}) },
  };
}

/**
 * メッセージを編集する。
 *
 * **`editedAt` を記録する**ことで、画面に「(編集済み)」を出せる。
 * 編集履歴を隠すと、後から内容を書き換えられて揉める。
 *
 * @param message 対象のメッセージ
 * @param body 新しい本文
 * @param now 現在時刻(テスト注入用)
 * @returns 編集した**新しい**メッセージ(元は変更しない)
 * @throws {@link @platform/core#AppError} コード `VALIDATION` — 本文が不正な場合
 */
export function editMessage(message: ChatMessage, newText: string, at?: string): CreateMessageResult {
  const text = newText.trim();
  if (text.length === 0) return { ok: false, error: "メッセージが空です" };
  if (text.length > MAX_MESSAGE_LENGTH) return { ok: false, error: "メッセージが長すぎます" };
  return { ok: true, message: { ...message, text, editedAt: at ?? new Date().toISOString() } };
}

/**
 * 時系列(古い → 新しい)に並べる。
 *
 * @param messages メッセージの配列
 * @returns 並べ替えた新しい配列(**チャットは古い順が自然**)
 */
export function sortMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages.slice().sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
}

/**
 * 日付ごとにまとめる(画面の日付区切り用)。
 *
 * @param messages メッセージの配列
 * @returns 日付(YYYY-MM-DD)とその日のメッセージ(**古い順**)
 */
export function groupByDate(messages: ChatMessage[]): { date: string; messages: ChatMessage[] }[] {
  const sorted = sortMessages(messages);
  const groups: { date: string; messages: ChatMessage[] }[] = [];
  for (const m of sorted) {
    const date = m.at.slice(0, 10);
    const last = groups[groups.length - 1];
    if (last && last.date === date) last.messages.push(m);
    else groups.push({ date, messages: [m] });
  }
  return groups;
}

/**
 * 本文からメンション(@handle)を抽出する。
 *
 * @param body 本文
 * @returns ハンドルの配列(**重複は除く**。同じ人を 2 回書いても通知は 1 回)
 */
export function extractMentions(text: string): string[] {
  const matches = text.match(/@([A-Za-z0-9_.-]+)/g) ?? [];
  return [...new Set(matches.map((m) => m.slice(1)))];
}

/**
 * 指定ユーザー宛(メンション)のメッセージを返す。
 *
 * @param messages メッセージの配列
 * @param handle 宛先のハンドル
 * @returns メンションされたメッセージ
 */
export function mentionsOf(messages: ChatMessage[], handle: string): ChatMessage[] {
  return messages.filter((m) => extractMentions(m.text).includes(handle));
}

/**
 * あるメッセージへの返信一覧(スレッド)を返す。
 *
 * @param messages メッセージの配列
 * @param parentId 親メッセージの ID
 * @returns 返信(古い順)
 */
export function repliesTo(messages: ChatMessage[], messageId: string): ChatMessage[] {
  return sortMessages(messages.filter((m) => m.replyTo === messageId));
}

/**
 * 編集・削除の権限を判定する。
 *
 * **送信者本人か管理者のみ**。他人の発言を勝手に消せると信頼が壊れる。
 *
 * @param message 対象のメッセージ
 * @param userId 操作する人
 * @param isAdmin 管理者か
 * @returns 編集・削除してよいなら true
 */
export function canModifyMessage(message: ChatMessage, userId: string, isAdmin = false): boolean {
  return isAdmin || message.senderId === userId;
}

/**
 * 未読のメンションを返す。
 *
 * **通知の対象**。既読のものを再通知すると、通知が信用されなくなる。
 *
 * @param messages メッセージの配列
 * @param handle 宛先のハンドル
 * @param lastReadAt 最終既読時刻(**未設定なら全件が未読**)
 * @returns 未読のメンション(古い順)
 */
export function unreadMentionsOf(messages: ChatMessage[], handle: string, lastReadAt?: string): ChatMessage[] {
  return mentionsOf(messages, handle).filter((m) => !lastReadAt || m.at > lastReadAt);
}

