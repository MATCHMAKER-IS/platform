/**
 * 掲示板の表示用ビューモデル。@platform/board の集計を PostCard / 一覧が使う形へ整形する。
 * @packageDocumentation
 */
import { type Thread, type Post, type Reaction, countReactions, userReactions, summarize, sortThreads, type ThreadSummary } from "@platform/board";

/** PostCard 用のリアクション表示。 */
export interface ReactionView {
  kind: string;
  count: number;
  reacted: boolean;
}

/** PostCard 用の投稿ビュー。 */
export interface PostView {
  id: string;
  authorName: string;
  body: string;
  timestamp: string;
  edited: boolean;
  reactions: ReactionView[];
}

/** 投稿を、自分のリアクション状態つきで PostCard 用に整形する。 */
export function toPostView(post: Post, reactions: Reaction[], meId: string, nameOf: (userId: string) => string): PostView {
  const counts = countReactions(reactions, post.id);
  const mine = new Set(userReactions(reactions, post.id, meId));
  const reactionViews: ReactionView[] = Object.entries(counts).map(([kind, count]) => ({ kind, count, reacted: mine.has(kind) }));
  return { id: post.id, authorName: nameOf(post.authorId), body: post.body, timestamp: post.createdAt.slice(0, 16).replace("T", " "), edited: Boolean(post.editedAt), reactions: reactionViews };
}

/** スレッド一覧を要約し、ピン→最新順に並べた要約を返す。 */
export function toThreadList(threads: Thread[], postsByThread: Record<string, Post[]>): ThreadSummary[] {
  const summaries = threads.map((t) => summarize(t, postsByThread[t.id] ?? []));
  return sortThreads(summaries);
}
