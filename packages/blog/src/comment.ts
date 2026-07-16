/**
 * コメント(純ロジック)。
 * フラットなコメント配列を親子のツリーに組み立て、承認状態での絞り込み・並び替え・件数集計を行う。
 * @packageDocumentation
 */

/** コメントの承認状態。 */
export type CommentStatus = "pending" | "approved" | "spam" | "rejected";

/** コメント(保存される形・フラット)。 */
export interface Comment {
  id: string;
  /** 親コメント ID(トップレベルは null/未指定)。 */
  parentId?: string | null;
  author: string;
  body: string;
  createdAt: string;
  status?: CommentStatus;
  [key: string]: unknown;
}

/** ツリー化されたコメント。 */
export interface CommentNode extends Comment {
  replies: CommentNode[];
}

/**
 * フラットなコメント配列を親子ツリーに組み立てる。
 * 親が見つからないコメントはトップレベル扱い(親が非承認で除外された場合など)。
 *
 * @param comments フラットなコメントの配列
 * @returns 親子ツリー。**親が見つからないものはトップレベル**(親が非承認で除外された場合など。
 *   親が無いからと捨てると、返信が消えてしまう)
 */
export function buildCommentTree(comments: Comment[]): CommentNode[] {
  const nodes = new Map<string, CommentNode>();
  for (const c of comments) nodes.set(c.id, { ...c, replies: [] });
  const roots: CommentNode[] = [];
  for (const c of comments) {
    const node = nodes.get(c.id)!;
    const parent = c.parentId ? nodes.get(c.parentId) : undefined;
    if (parent) parent.replies.push(node);
    else roots.push(node);
  }
  return roots;
}

/**
 * 承認済みのコメントだけを返す。
 *
 * **表示の前に必ず通す**。未承認のコメント(スパムを含む)が出ると信頼を失う。
 *
 * @param comments コメントの配列
 * @returns 承認済みのコメント
 */
export function approvedComments<T extends Comment>(comments: T[]): T[] {
  return comments.filter((c) => (c.status ?? "approved") === "approved");
}

/**
 * コメントを並び替える。
 *
 * @param comments コメントの配列
 * @param order `newest`(新しい順)/ `oldest`(古い順 = 会話の流れ)
 * @returns 並べ替えた新しい配列
 */
export function sortComments<T extends Comment>(comments: T[], order: "newest" | "oldest" = "oldest"): T[] {
  const sorted = [...comments].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  return order === "newest" ? sorted.reverse() : sorted;
}

/**
 * コメントの総数を数える(**返信も含む**)。
 *
 * 「コメント 3 件」と出すとき、返信を数えないと実感と合わない。
 *
 * @param comments コメントのツリー
 * @returns 総数
 */
export function countComments(nodes: CommentNode[]): number {
  return nodes.reduce((sum, n) => sum + 1 + countComments(n.replies), 0);
}

/**
 * 承認待ちの件数を返す(モデレーション用)。
 *
 * @param comments コメントの配列
 * @returns 承認待ちの件数
 */
export function pendingCount(comments: Comment[]): number {
  return comments.filter((c) => c.status === "pending").length;
}
