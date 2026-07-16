/**
 * CMS のダッシュボード用集計（純関数）。
 * @packageDocumentation
 */
import { type CmsPost } from "./model";
import { effectiveStatus } from "./scheduling";

/** 記事の状態別集計。 */
export interface PostSummary {
  total: number;
  published: number;
  draft: number;
  scheduled: number;
}

/**
 * 記事を**実効ステータス**で集計する(管理画面のダッシュボード用)。
 *
 * DB の `status` ではなく実効ステータスで数えるので、
 * 「予約日時を過ぎた記事」は公開中として数えられる。
 *
 * @param posts 記事の配列
 * @param now 判定する時点(テスト注入用)
 * @returns 状態ごとの件数
 */
export function summarizePosts(posts: CmsPost[], now: Date = new Date()): PostSummary {
  const summary: PostSummary = { total: posts.length, published: 0, draft: 0, scheduled: 0 };
  for (const p of posts) {
    const status = effectiveStatus(p, now);
    if (status === "published") summary.published += 1;
    else if (status === "scheduled") summary.scheduled += 1;
    else summary.draft += 1;
  }
  return summary;
}

/**
 * 最近更新された記事を返す(管理画面の「最近の更新」用)。
 *
 * @param posts 記事の配列
 * @param limit 件数(既定 5)
 * @param now 判定する時点(実効ステータスの計算に使う)
 * @returns 更新の新しい順に上位 N 件
 */
export function recentPosts(posts: CmsPost[], limit = 5, now: Date = new Date()): { slug: string; title: string; updatedAt: string; status: string }[] {
  return posts
    .slice()
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0))
    .slice(0, limit)
    .map((p) => ({ slug: p.slug, title: p.title, updatedAt: p.updatedAt, status: effectiveStatus(p, now) }));
}
