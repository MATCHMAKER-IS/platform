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

/** スレッドを作成する。 */
export function createThread(input: { id: string; title: string; authorId: string; tags?: string[]; createdAt?: string }): ThreadResult {
  const title = input.title.trim();
  if (title.length === 0) return { ok: false, error: "タイトルが空です" };
  if (title.length > MAX_TITLE_LENGTH) return { ok: false, error: `タイトルが長すぎます(最大${MAX_TITLE_LENGTH}文字)` };
  return { ok: true, thread: { id: input.id, title, authorId: input.authorId, createdAt: input.createdAt ?? new Date().toISOString(), ...(input.tags && input.tags.length ? { tags: input.tags } : {}) } };
}

/** 投稿を作成する。空・長すぎは失敗。 */
export function createPost(input: { id: string; authorId: string; body: string; replyTo?: string; createdAt?: string; attachments?: Attachment[] }): PostResult {
  const body = input.body.trim();
  const attachments = input.attachments ?? [];
  if (body.length === 0 && attachments.length === 0) return { ok: false, error: "本文が空です" };
  if (body.length > MAX_POST_LENGTH) return { ok: false, error: `本文が長すぎます(最大${MAX_POST_LENGTH}文字)` };
  return { ok: true, post: { id: input.id, authorId: input.authorId, body, createdAt: input.createdAt ?? new Date().toISOString(), ...(input.replyTo ? { replyTo: input.replyTo } : {}), ...(attachments.length > 0 ? { attachments } : {}) } };
}

/** スレッドが施錠されていれば返信を拒否する。 */
export function canReply(thread: Thread): boolean {
  return !thread.locked;
}

/** スレッド本文(replyTo なし)を返す。 */
export function rootPosts(posts: Post[]): Post[] {
  return posts.filter((p) => !p.replyTo);
}

/** ある投稿への返信を古い順で返す。 */
export function repliesOf(posts: Post[], postId: string): Post[] {
  return posts.filter((p) => p.replyTo === postId).sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
}

/** 本文からメンション(@handle)を抽出する。 */
export function extractMentions(body: string): string[] {
  const matches = body.match(/@([A-Za-z0-9_.-]+)/g) ?? [];
  return [...new Set(matches.map((m) => m.slice(1)))];
}

/** 投稿を編集する(本文と editedAt を更新)。空・長すぎは失敗。 */
export function editPost(post: Post, newBody: string, at?: string): PostResult {
  const body = newBody.trim();
  if (body.length === 0) return { ok: false, error: "本文が空です" };
  if (body.length > MAX_POST_LENGTH) return { ok: false, error: `本文が長すぎます(最大${MAX_POST_LENGTH}文字)` };
  return { ok: true, post: { ...post, body, editedAt: at ?? new Date().toISOString() } };
}

/** 投稿を編集/削除できるのは投稿者本人、または管理者。 */
export function canModifyPost(post: Post, userId: string, isAdmin = false): boolean {
  return isAdmin || post.authorId === userId;
}

