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

/**
 * リアクションを付ける/外す(同じものを再度押すと解除)。
 *
 * @param reactions 現在のリアクション
 * @param input メッセージ・ユーザー・種別
 * @param now 現在時刻(テスト注入用)
 * @returns 更新した**新しい**配列と、付けたか外したか
 */
export function toggleReaction(reactions: MessageReaction[], reaction: MessageReaction): MessageReaction[] {
  const exists = reactions.some((r) => r.messageId === reaction.messageId && r.userId === reaction.userId && r.kind === reaction.kind);
  if (exists) return reactions.filter((r) => !(r.messageId === reaction.messageId && r.userId === reaction.userId && r.kind === reaction.kind));
  return [...reactions, reaction];
}

/**
 * メッセージのリアクションを種別ごとに数える。
 *
 * @param reactions リアクションの配列
 * @param messageId メッセージ
 * @returns 種別 → 件数(**多い順**。画面でよく押されたものを先に見せる)
 */
export function countReactions(reactions: MessageReaction[], messageId: string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const r of reactions) {
    if (r.messageId !== messageId) continue;
    counts[r.kind] = (counts[r.kind] ?? 0) + 1;
  }
  return counts;
}

/**
 * あるユーザーがそのメッセージに押した種別を返す。
 *
 * 画面で「自分が押したもの」を強調するのに使う。
 *
 * @param reactions リアクションの配列
 * @param messageId メッセージ
 * @param userId ユーザー
 * @returns 押した種別の配列
 */
export function userReactions(reactions: MessageReaction[], messageId: string, userId: string): string[] {
  return reactions.filter((r) => r.messageId === messageId && r.userId === userId).map((r) => r.kind);
}
