/**
 * メッセージのリアクション(純ロジック)。1 ユーザー 1 種別 1 回、再押しで解除。
 * @packageDocumentation
 */

/** リアクション 1 件。 */
export interface MessageReaction {
  messageId: string;
  userId: string;
  /** 種別(例 "like", "eyes", "check")。 */
  kind: string;
}

/** リアクションを付与/解除する(同種を再度押すと解除=トグル)。 */
export function toggleReaction(reactions: MessageReaction[], reaction: MessageReaction): MessageReaction[] {
  const exists = reactions.some((r) => r.messageId === reaction.messageId && r.userId === reaction.userId && r.kind === reaction.kind);
  if (exists) return reactions.filter((r) => !(r.messageId === reaction.messageId && r.userId === reaction.userId && r.kind === reaction.kind));
  return [...reactions, reaction];
}

/** メッセージの種別ごとの件数を集計する。 */
export function countReactions(reactions: MessageReaction[], messageId: string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const r of reactions) {
    if (r.messageId !== messageId) continue;
    counts[r.kind] = (counts[r.kind] ?? 0) + 1;
  }
  return counts;
}

/** あるユーザーがそのメッセージに押した種別を返す。 */
export function userReactions(reactions: MessageReaction[], messageId: string, userId: string): string[] {
  return reactions.filter((r) => r.messageId === messageId && r.userId === userId).map((r) => r.kind);
}
