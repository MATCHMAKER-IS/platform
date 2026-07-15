/**
 * リアクション(いいね等)の集計(純ロジック)。1 ユーザー 1 種別 1 回。
 * @packageDocumentation
 */

/** リアクション 1 件。 */
export interface Reaction {
  postId: string;
  userId: string;
  /** 種別(例 "like", "+1", "eyes")。 */
  kind: string;
}

/** リアクションを付与/解除する(同じ種別を再度押すと解除=トグル)。 */
export function toggleReaction(reactions: Reaction[], reaction: Reaction): Reaction[] {
  const exists = reactions.some((r) => r.postId === reaction.postId && r.userId === reaction.userId && r.kind === reaction.kind);
  if (exists) return reactions.filter((r) => !(r.postId === reaction.postId && r.userId === reaction.userId && r.kind === reaction.kind));
  return [...reactions, reaction];
}

/** 投稿ごと・種別ごとの件数を集計する。 */
export function countReactions(reactions: Reaction[], postId: string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const r of reactions) {
    if (r.postId !== postId) continue;
    counts[r.kind] = (counts[r.kind] ?? 0) + 1;
  }
  return counts;
}

/** あるユーザーがその投稿に押した種別を返す。 */
export function userReactions(reactions: Reaction[], postId: string, userId: string): string[] {
  return reactions.filter((r) => r.postId === postId && r.userId === userId).map((r) => r.kind);
}
