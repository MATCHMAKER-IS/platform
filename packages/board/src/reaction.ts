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

/**
 * リアクションを付ける/外す(同じものを再度押すと解除)。
 *
 * @param reactions 現在のリアクション
 * @param reaction 付ける/外すリアクション(投稿・ユーザー・種別)
 * @returns 更新した**新しい**配列と、付けたか外したか
 */
export function toggleReaction(reactions: Reaction[], reaction: Reaction): Reaction[] {
  const exists = reactions.some((r) => r.postId === reaction.postId && r.userId === reaction.userId && r.kind === reaction.kind);
  if (exists) return reactions.filter((r) => !(r.postId === reaction.postId && r.userId === reaction.userId && r.kind === reaction.kind));
  return [...reactions, reaction];
}

/**
 * 投稿のリアクションを種別ごとに数える。
 *
 * @param reactions リアクションの配列
 * @param postId 投稿
 * @returns 種別 → 件数(**多い順**)
 */
export function countReactions(reactions: Reaction[], postId: string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const r of reactions) {
    if (r.postId !== postId) continue;
    counts[r.kind] = (counts[r.kind] ?? 0) + 1;
  }
  return counts;
}

/**
 * あるユーザーがその投稿に押した種別を返す。
 *
 * 画面で「自分が押したもの」を強調するのに使う。
 *
 * @param reactions リアクションの配列
 * @param postId 投稿
 * @param userId ユーザー
 * @returns 押した種別の配列
 */
export function userReactions(reactions: Reaction[], postId: string, userId: string): string[] {
  return reactions.filter((r) => r.postId === postId && r.userId === userId).map((r) => r.kind);
}
