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

/** 承認済みコメントだけを返す。 */
export function approvedComments<T extends Comment>(comments: T[]): T[] {
  return comments.filter((c) => (c.status ?? "approved") === "approved");
}

/** コメントを並び替える("newest" | "oldest")。 */
export function sortComments<T extends Comment>(comments: T[], order: "newest" | "oldest" = "oldest"): T[] {
  const sorted = [...comments].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  return order === "newest" ? sorted.reverse() : sorted;
}

/** ツリー全体のコメント総数(返信含む)を数える。 */
export function countComments(nodes: CommentNode[]): number {
  return nodes.reduce((sum, n) => sum + 1 + countComments(n.replies), 0);
}

/** 承認待ちの件数(モデレーション用)。 */
export function pendingCount(comments: Comment[]): number {
  return comments.filter((c) => c.status === "pending").length;
}
