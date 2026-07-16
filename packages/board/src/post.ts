/**
 * 掲示板の投稿・スレッド(純ロジック)。投稿検証・返信・リアクション・整列・要約。
 * @packageDocumentation
 */

import { type Attachment } from "./attachment.js";

/** 投稿(スレッドの本文 or 返信)。 */
export interface Post {
  id: string;
  authorId: string;
  body: string;
  createdAt: string;
  /** 返信先の投稿 ID(スレッド本文なら未設定)。 */
  replyTo?: string;
  editedAt?: string;
  /** 添付ファイル。 */
  attachments?: Attachment[];
}

/** スレッド。 */
export interface Thread {
  id: string;
  title: string;
  authorId: string;
  createdAt: string;
  /** ピン留め(先頭固定)。 */
  pinned?: boolean;
  /** 施錠(返信不可)。 */
  locked?: boolean;
  /** タグ。 */
  tags?: string[];
}

/** 投稿本文の上限。 */
export const MAX_POST_LENGTH = 10000;
/** スレッドタイトルの上限。 */
export const MAX_TITLE_LENGTH = 200;

export type PostResult = { ok: true; post: Post } | { ok: false; error: string };
export type ThreadResult = { ok: true; thread: Thread } | { ok: false; error: string };

/**
 * スレッドを作成する。
 *
 * **例外を投げず Result で返す**(入力の不備は「異常」ではなく「よくあること」なので、
 * 呼び出し側が画面にエラーを出しやすい形にしている)。
 *
 * @param input.id ID
 * @param input.title タイトル(**空・長すぎは失敗**)
 * @param input.authorId 作成者
 * @param input.tags タグ(任意)
 * @param input.createdAt 作成日時(省略時は現在)
 * @returns `{ ok: true, thread }` または `{ ok: false, error }`
 */
export function createThread(input: { id: string; title: string; authorId: string; tags?: string[]; createdAt?: string }): ThreadResult {
  const title = input.title.trim();
  if (title.length === 0) return { ok: false, error: "タイトルが空です" };
  if (title.length > MAX_TITLE_LENGTH) return { ok: false, error: `タイトルが長すぎます(最大${MAX_TITLE_LENGTH}文字)` };
  return { ok: true, thread: { id: input.id, title, authorId: input.authorId, createdAt: input.createdAt ?? new Date().toISOString(), ...(input.tags && input.tags.length ? { tags: input.tags } : {}) } };
}

/**
 * 投稿を作成する。
 *
 * **例外を投げず Result で返す**(入力の不備は呼び出し側が画面に出すもの)。
 * **本文が空でも添付があれば通る**(画像だけの投稿を許す)。
 *
 * @param input.id ID
 * @param input.authorId 投稿者
 * @param input.body 本文(**空・長すぎは失敗**。ただし添付があれば空でも可)
 * @param input.replyTo 返信先の投稿 ID(任意。無ければスレッド本文)
 * @param input.createdAt 作成日時(省略時は現在)
 * @param input.attachments 添付(任意)
 * @returns `{ ok: true, post }` または `{ ok: false, error }`
 */
export function createPost(input: { id: string; authorId: string; body: string; replyTo?: string; createdAt?: string; attachments?: Attachment[] }): PostResult {
  const body = input.body.trim();
  const attachments = input.attachments ?? [];
  if (body.length === 0 && attachments.length === 0) return { ok: false, error: "本文が空です" };
  if (body.length > MAX_POST_LENGTH) return { ok: false, error: `本文が長すぎます(最大${MAX_POST_LENGTH}文字)` };
  return { ok: true, post: { id: input.id, authorId: input.authorId, body, createdAt: input.createdAt ?? new Date().toISOString(), ...(input.replyTo ? { replyTo: input.replyTo } : {}), ...(attachments.length > 0 ? { attachments } : {}) } };
}

/**
 * スレッドに返信してよいかを判定する。
 *
 * **返信を作る前に必ず通す**。荒れたスレッドを止めたのに書き込めては意味がない。
 * 施錠されていれば false を返すので、**呼び出し側で 403 にすること**
 * (この関数は例外を投げない)。
 *
 * @param thread スレッド
 * @returns 施錠されていなければ true
 */
export function canReply(thread: Thread): boolean {
  return !thread.locked;
}

/**
 * スレッドの本文(最初の投稿)を返す。
 *
 * @param posts 投稿の配列
 * @returns `replyTo` を持たない投稿(**返信ではないもの**)
 */
export function rootPosts(posts: Post[]): Post[] {
  return posts.filter((p) => !p.replyTo);
}

/**
 * ある投稿への返信を返す。
 *
 * @param posts 投稿の配列
 * @param postId 親投稿の ID
 * @returns 返信(**古い順**。会話は古い順が自然)
 */
export function repliesOf(posts: Post[], postId: string): Post[] {
  return posts.filter((p) => p.replyTo === postId).sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
}

/**
 * 本文からメンション(@handle)を抽出する。
 *
 * @param body 本文
 * @returns ハンドルの配列(重複は除く)
 */
export function extractMentions(body: string): string[] {
  const matches = body.match(/@([A-Za-z0-9_.-]+)/g) ?? [];
  return [...new Set(matches.map((m) => m.slice(1)))];
}

/**
 * 投稿を編集する。
 *
 * **`editedAt` を記録する**ことで画面に「(編集済み)」を出せる。
 * 後から内容を書き換えたことを隠せない状態にしておく。
 *
 * @param post 対象の投稿
 * @param newBody 新しい本文(**空・長すぎは失敗**)
 * @param at 編集日時(省略時は現在)
 * @returns `{ ok: true, post }`(**新しいオブジェクト**。元は変更しない)または `{ ok: false, error }`
 */
export function editPost(post: Post, newBody: string, at?: string): PostResult {
  const body = newBody.trim();
  if (body.length === 0) return { ok: false, error: "本文が空です" };
  if (body.length > MAX_POST_LENGTH) return { ok: false, error: `本文が長すぎます(最大${MAX_POST_LENGTH}文字)` };
  return { ok: true, post: { ...post, body, editedAt: at ?? new Date().toISOString() } };
}

/**
 * 編集・削除の権限を判定する。
 *
 * **投稿者本人か管理者のみ**。他人の発言を勝手に消せると信頼が壊れる。
 *
 * @param post 対象の投稿
 * @param userId 操作する人
 * @param isAdmin 管理者か
 * @returns 編集・削除してよいなら true
 */
export function canModifyPost(post: Post, userId: string, isAdmin = false): boolean {
  return isAdmin || post.authorId === userId;
}

