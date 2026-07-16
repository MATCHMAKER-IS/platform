/**
 * 公開予約（スケジュール）のロジック（純関数）。
 * status=published でも publishedAt が未来なら「予約」。過去/現在なら「公開中」。
 * @packageDocumentation
 */
import { type CmsPost } from "./model";

/** 実効ステータス。 */
export type EffectiveStatus = "draft" | "scheduled" | "published";

/**
 * ある時点での実効ステータスを求める。
 *
 * **DB の `status` をそのまま信じない**。予約公開(`scheduled`)は、
 * 予約日時を過ぎたら「公開中」として扱う必要がある。
 * DB の値を書き換えるバッチが動いていなくても、読む側で正しく判定できるようにする。
 *
 * @param post 記事
 * @param now 判定する時点(テスト注入用。既定は現在)
 * @returns その時点での実効ステータス
 */
export function effectiveStatus(post: CmsPost, now: Date = new Date()): EffectiveStatus {
  if (post.status !== "published") return "draft";
  if (!post.publishedAt) return "published";
  return new Date(post.publishedAt).getTime() > now.getTime() ? "scheduled" : "published";
}

/**
 * 今この記事が読者に見えるかを判定する。
 *
 * **一覧・詳細を返す前に必ず通す**。下書きや予約前の記事が漏れると事故になる。
 *
 * @param post 記事
 * @param now 判定する時点(テスト注入用)
 * @returns 読者に見えるなら true
 */
export function isLive(post: CmsPost, now: Date = new Date()): boolean {
  return effectiveStatus(post, now) === "published";
}

/**
 * 公開中の記事だけを、公開日時の新しい順で返す。
 *
 * @param posts 記事の配列(下書きが混ざっていてよい。内部で絞る)
 * @param now 判定する時点(テスト注入用)
 * @returns 公開中の記事(新しい順)
 */
export function livePosts(posts: CmsPost[], now: Date = new Date()): CmsPost[] {
  return posts
    .filter((p) => isLive(p, now))
    .sort((a, b) => ((a.publishedAt ?? a.updatedAt) < (b.publishedAt ?? b.updatedAt) ? 1 : (a.publishedAt ?? a.updatedAt) > (b.publishedAt ?? b.updatedAt) ? -1 : 0));
}

/**
 * 予約公開の記事を返す(まだ公開されていないもの)。
 *
 * **管理画面で「次に何が公開されるか」を見せる**用途。
 *
 * @param posts 記事の配列
 * @param now 判定する時点(テスト注入用)
 * @returns 予約公開の記事(**公開が近い順**)
 */
export function scheduledPosts(posts: CmsPost[], now: Date = new Date()): CmsPost[] {
  return posts
    .filter((p) => effectiveStatus(p, now) === "scheduled")
    .sort((a, b) => ((a.publishedAt ?? "") < (b.publishedAt ?? "") ? -1 : 1));
}

/**
 * 予約公開までの残り時間を返す。
 *
 * @param post 記事
 * @param now 判定する時点(テスト注入用)
 * @returns 残りミリ秒。**予約でない/既に過ぎている場合は null**
 *   (「あと -3 時間」と表示しないため。過ぎたものは「公開中」であって「予約」ではない)
 */
export function msUntilPublish(post: CmsPost, now: Date = new Date()): number | null {
  if (effectiveStatus(post, now) !== "scheduled" || !post.publishedAt) return null;
  return new Date(post.publishedAt).getTime() - now.getTime();
}
