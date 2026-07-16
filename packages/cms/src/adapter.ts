/**
 * CMS 記事を公開サイト向けのブログビューに変換する（純関数）。
 * @packageDocumentation
 */
import { type CmsPost } from "./model";
import { livePosts } from "./scheduling";

/** 公開サイト向けのブログ記事ビュー。 */
export interface BlogView {
  slug: string;
  title: string;
  categoryId?: string;
  excerpt?: string;
  eyecatch?: string;
  body: string;
  publishedAt: string;
  tags: string[];
}

/**
 * 記事を公開サイト用のブログビューに変換する。
 *
 * **管理用の項目(status など)を落とす**。公開サイトに内部情報を渡さないため。
 *
 * @param post 記事
 * @returns 公開サイト用のビュー
 */
export function cmsPostToBlog(post: CmsPost): BlogView {
  const view: BlogView = { slug: post.slug, title: post.title, body: post.body, tags: post.tags, publishedAt: post.publishedAt ?? post.updatedAt };
  if (post.categoryId !== undefined) view.categoryId = post.categoryId;
  if (post.excerpt !== undefined) view.excerpt = post.excerpt;
  if (post.eyecatch !== undefined) view.eyecatch = post.eyecatch;
  return view;
}

/**
 * 公開中の記事だけを、公開サイト用の配列にする(新しい順)。
 *
 * @param posts 記事の配列(下書きが混ざっていてよい)
 * @param now 判定する時点(テスト注入用)
 * @returns 公開中の記事のビュー(新しい順)
 */
export function liveBlogViews(posts: CmsPost[], now: Date = new Date()): BlogView[] {
  return livePosts(posts, now).map(cmsPostToBlog);
}
