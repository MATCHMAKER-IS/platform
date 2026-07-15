/**
 * チャットメッセージ(純ロジック)。作成・検証・整列・日付グループ化・メンション抽出。
 * @packageDocumentation
 */

import { type Attachment } from "./attachment.js";

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

/** メッセージを作成する。空・空白のみ・長すぎは失敗。 */
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

/** メッセージを編集する(本文と editedAt を更新)。 */
export function editMessage(message: ChatMessage, newText: string, at?: string): CreateMessageResult {
  const text = newText.trim();
  if (text.length === 0) return { ok: false, error: "メッセージが空です" };
  if (text.length > MAX_MESSAGE_LENGTH) return { ok: false, error: "メッセージが長すぎます" };
  return { ok: true, message: { ...message, text, editedAt: at ?? new Date().toISOString() } };
}

/** 時系列(古い→新しい)に整列する。 */
export function sortMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages.slice().sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
}

/** 日付ごとにグループ化する(表示の日付区切り用)。 */
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

/** 本文からメンション(@handle)を抽出する(重複除去)。 */
export function extractMentions(text: string): string[] {
  const matches = text.match(/@([A-Za-z0-9_.-]+)/g) ?? [];
  return [...new Set(matches.map((m) => m.slice(1)))];
}

/** 指定ユーザー宛(メンション)のメッセージを返す。 */
export function mentionsOf(messages: ChatMessage[], handle: string): ChatMessage[] {
  return messages.filter((m) => extractMentions(m.text).includes(handle));
}

/** あるメッセージへの返信一覧(スレッド)。 */
export function repliesTo(messages: ChatMessage[], messageId: string): ChatMessage[] {
  return sortMessages(messages.filter((m) => m.replyTo === messageId));
}

/** メッセージを編集/削除できるのは送信者本人、または管理者。 */
export function canModifyMessage(message: ChatMessage, userId: string, isAdmin = false): boolean {
  return isAdmin || message.senderId === userId;
}

/** 指定ハンドル宛メンションのうち、最終既読より後のものを返す(未読メンション)。 */
export function unreadMentionsOf(messages: ChatMessage[], handle: string, lastReadAt?: string): ChatMessage[] {
  return mentionsOf(messages, handle).filter((m) => !lastReadAt || m.at > lastReadAt);
}

