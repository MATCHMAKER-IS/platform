/**
 * CMS のダッシュボード用集計（純関数）。
 * @packageDocumentation
 */
import { type CmsPost } from "./model.js";
import { effectiveStatus } from "./scheduling.js";

/** 記事の状態別集計。 */
export interface PostSummary {
  total: number;
  published: number;
  draft: number;
  scheduled: number;
}

/** 記事を実効ステータスで集計する。 */
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

/** 更新日時の新しい順に上位 N 件（{slug,title,updatedAt,status}）を返す。 */
export function recentPosts(posts: CmsPost[], limit = 5, now: Date = new Date()): { slug: string; title: string; updatedAt: string; status: string }[] {
  return posts
    .slice()
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0))
    .slice(0, limit)
    .map((p) => ({ slug: p.slug, title: p.title, updatedAt: p.updatedAt, status: effectiveStatus(p, now) }));
}
