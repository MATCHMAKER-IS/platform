/**
 * CMS 記事を公開サイト向けのブログビューに変換する（純関数）。
 * @packageDocumentation
 */
import { type CmsPost } from "./model.js";
import { livePosts } from "./scheduling.js";

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

/** 1 記事をブログビューに変換する。 */
export function cmsPostToBlog(post: CmsPost): BlogView {
  const view: BlogView = { slug: post.slug, title: post.title, body: post.body, tags: post.tags, publishedAt: post.publishedAt ?? post.updatedAt };
  if (post.categoryId !== undefined) view.categoryId = post.categoryId;
  if (post.excerpt !== undefined) view.excerpt = post.excerpt;
  if (post.eyecatch !== undefined) view.eyecatch = post.eyecatch;
  return view;
}

/** 公開中の記事だけをブログビューの配列（新しい順）にする。 */
export function liveBlogViews(posts: CmsPost[], now: Date = new Date()): BlogView[] {
  return livePosts(posts, now).map(cmsPostToBlog);
}
