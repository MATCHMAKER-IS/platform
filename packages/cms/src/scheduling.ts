/**
 * 公開予約（スケジュール）のロジック（純関数）。
 * status=published でも publishedAt が未来なら「予約」。過去/現在なら「公開中」。
 * @packageDocumentation
 */
import { type CmsPost } from "./model.js";

/** 実効ステータス。 */
export type EffectiveStatus = "draft" | "scheduled" | "published";

/** ある時点での実効ステータスを求める。 */
export function effectiveStatus(post: CmsPost, now: Date = new Date()): EffectiveStatus {
  if (post.status !== "published") return "draft";
  if (!post.publishedAt) return "published";
  return new Date(post.publishedAt).getTime() > now.getTime() ? "scheduled" : "published";
}

/** 今この記事が公開中（読者に見える）か。 */
export function isLive(post: CmsPost, now: Date = new Date()): boolean {
  return effectiveStatus(post, now) === "published";
}

/** 公開中の記事だけを公開日時の新しい順で返す。 */
export function livePosts(posts: CmsPost[], now: Date = new Date()): CmsPost[] {
  return posts
    .filter((p) => isLive(p, now))
    .sort((a, b) => ((a.publishedAt ?? a.updatedAt) < (b.publishedAt ?? b.updatedAt) ? 1 : (a.publishedAt ?? a.updatedAt) > (b.publishedAt ?? b.updatedAt) ? -1 : 0));
}

/** 予約公開の記事（未来に公開されるもの・公開日時の昇順=近い順）。 */
export function scheduledPosts(posts: CmsPost[], now: Date = new Date()): CmsPost[] {
  return posts
    .filter((p) => effectiveStatus(p, now) === "scheduled")
    .sort((a, b) => ((a.publishedAt ?? "") < (b.publishedAt ?? "") ? -1 : 1));
}

/** 予約公開までの残りミリ秒（予約でなければ null）。過ぎていれば 0 以下ではなく null 扱い。 */
export function msUntilPublish(post: CmsPost, now: Date = new Date()): number | null {
  if (effectiveStatus(post, now) !== "scheduled" || !post.publishedAt) return null;
  return new Date(post.publishedAt).getTime() - now.getTime();
}
