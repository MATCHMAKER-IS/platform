/**
 * ブログ記事の関連・前後ナビ・タグ集計（純関数・汎用）。
 * BlogPost などの最小インターフェースに対して動く。
 * @packageDocumentation
 */

/** ブログ記事的なもの（最小要件）。 */
export interface BlogLike {
  id: string;
  categoryId?: string;
  tags?: string[];
  /** 公開日時（ISO）。 */
  publishedAt: string;
}

/** 公開日時の昇順（古い→新しい）に並べる。 */
function chronological<T extends BlogLike>(posts: T[]): T[] {
  return posts.slice().sort((a, b) => (a.publishedAt < b.publishedAt ? -1 : a.publishedAt > b.publishedAt ? 1 : 0));
}

/**
 * 前後の記事を返す(記事下部の「前の記事 / 次の記事」用)。
 *
 * @param posts 記事の配列
 * @param id 今見ている記事の ID
 * @returns `prev`(1 つ古い)と `next`(1 つ新しい)。**端なら undefined**
 */
export function adjacentPosts<T extends BlogLike>(posts: T[], id: string): { prev?: T; next?: T } {
  const sorted = chronological(posts);
  const i = sorted.findIndex((p) => p.id === id);
  if (i === -1) return {};
  const result: { prev?: T; next?: T } = {};
  if (i > 0) result.prev = sorted[i - 1]!;
  if (i < sorted.length - 1) result.next = sorted[i + 1]!;
  return result;
}

/**
 * 2 つの記事の関連スコアを求める。
 *
 * 共通タグの数 + 同じカテゴリなら加点。**単純だが実用には十分**
 * (機械学習を持ち込むほどの精度は要らない)。
 *
 * @param a 記事
 * @param b 記事
 * @returns スコア(大きいほど関連が強い)
 */
export function relatednessScore(a: BlogLike, b: BlogLike): number {
  let score = 0;
  const at = new Set(a.tags ?? []);
  for (const t of b.tags ?? []) if (at.has(t)) score += 2;
  if (a.categoryId && a.categoryId === b.categoryId) score += 1;
  return score;
}

/**
 * 関連記事を返す。
 *
 * **スコア 0 は除外**(関連が無いものを「関連記事」として出すと信用されない)。
 *
 * @param posts 記事の配列
 * @param target 今見ている記事
 * @param options.limit 件数(既定 3)
 * @returns 関連スコアの高い順(同点なら新しい順)。自分は含まない
 */
export function relatedPosts<T extends BlogLike>(posts: T[], target: T, options: { limit?: number } = {}): T[] {
  const limit = options.limit ?? 3;
  return posts
    .filter((p) => p.id !== target.id)
    .map((p) => ({ post: p, score: relatednessScore(target, p) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || (a.post.publishedAt < b.post.publishedAt ? 1 : -1))
    .slice(0, limit)
    .map((x) => x.post);
}

/**
 * タグ別の件数を集計する(タグクラウド用)。
 *
 * @param posts 記事の配列
 * @returns タグと件数(**多い順**、同数ならタグ名の昇順)
 */
export function allTags<T extends { tags?: string[] }>(posts: T[]): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const p of posts) for (const t of p.tags ?? []) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || (a.tag < b.tag ? -1 : 1));
}

/**
 * 特定のタグを持つ記事を返す。
 *
 * @param posts 記事の配列
 * @param tag タグ
 * @returns そのタグを持つ記事
 */
export function postsByTag<T extends { tags?: string[] }>(posts: T[], tag: string): T[] {
  return posts.filter((p) => (p.tags ?? []).includes(tag));
}
