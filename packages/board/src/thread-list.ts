/**
 * スレッド一覧の整列・要約(純ロジック)。
 * @packageDocumentation
 */
import { type Thread, type Post, rootPosts } from "./post.js";

/** スレッドの要約(一覧表示用)。 */
export interface ThreadSummary {
  thread: Thread;
  /** 返信数(本文を除く)。 */
  replyCount: number;
  /** 参加者数(投稿者のユニーク)。 */
  participants: number;
  /** 最終更新(最新投稿 or 作成日時)。 */
  lastActivityAt: string;
}

/** スレッドの投稿から要約を作る。 */
export function summarize(thread: Thread, posts: Post[]): ThreadSummary {
  const replies = posts.filter((p) => p.replyTo);
  const authors = new Set(posts.map((p) => p.authorId));
  authors.add(thread.authorId);
  const times = posts.map((p) => p.createdAt);
  const lastActivityAt = times.length > 0 ? times.reduce((a, b) => (a > b ? a : b)) : thread.createdAt;
  return { thread, replyCount: replies.length, participants: authors.size, lastActivityAt };
}

/** スレッド一覧を「ピン → 最終更新の新しい順」で並べる。 */
export function sortThreads(summaries: ThreadSummary[]): ThreadSummary[] {
  return summaries.slice().sort((a, b) => {
    const ap = a.thread.pinned ? 1 : 0;
    const bp = b.thread.pinned ? 1 : 0;
    if (ap !== bp) return bp - ap;
    return a.lastActivityAt > b.lastActivityAt ? -1 : a.lastActivityAt < b.lastActivityAt ? 1 : 0;
  });
}

/** タグで絞り込む。 */
export function filterByTag(summaries: ThreadSummary[], tag: string): ThreadSummary[] {
  return summaries.filter((s) => s.thread.tags?.includes(tag));
}

/** タイトル・本文のキーワードで検索する。 */
export function searchThreads(summaries: ThreadSummary[], postsByThread: Record<string, Post[]>, keyword: string): ThreadSummary[] {
  const kw = keyword.toLowerCase();
  return summaries.filter((s) => {
    if (s.thread.title.toLowerCase().includes(kw)) return true;
    return (postsByThread[s.thread.id] ?? []).some((p) => p.body.toLowerCase().includes(kw));
  });
}
