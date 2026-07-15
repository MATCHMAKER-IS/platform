/**
 * CMS 記事のモデルと検証（純関数）。
 * @packageDocumentation
 */

/** 保存される状態。 */
export type PostStatus = "draft" | "published";

/** CMS 記事。 */
export interface CmsPost {
  slug: string;
  title: string;
  categoryId?: string;
  excerpt?: string;
  eyecatch?: string;
  body: string;
  tags: string[];
  status: PostStatus;
  /** 公開日時（ISO）。未来日なら予約公開。 */
  publishedAt?: string;
  updatedAt: string;
}

/** 記事の入力（作成・更新）。 */
export interface CmsPostInput {
  slug: string;
  title: string;
  categoryId?: string;
  excerpt?: string;
  eyecatch?: string;
  body: string;
  tags?: string[];
  status?: PostStatus;
  publishedAt?: string;
}

/** slug の妥当性（英小文字・数字・ハイフン）。 */
export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

/** 入力を検証する。 */
export function validatePostInput(input: CmsPostInput): { ok: true; value: CmsPostInput } | { ok: false; error: string } {
  if (!input.slug || !isValidSlug(input.slug)) return { ok: false, error: "slug は英小文字・数字・ハイフンで指定してください" };
  if (!input.title.trim()) return { ok: false, error: "タイトルは必須です" };
  if (!input.body.trim()) return { ok: false, error: "本文は必須です" };
  if (input.publishedAt !== undefined && isNaN(new Date(input.publishedAt).getTime())) return { ok: false, error: "公開日時が不正です" };
  return { ok: true, value: input };
}

/** 入力を CmsPost に変換する（公開時は publishedAt を確定・予約日はそのまま）。 */
export function toPost(input: CmsPostInput, now: string): CmsPost {
  const status = input.status ?? "draft";
  const post: CmsPost = { slug: input.slug, title: input.title, body: input.body, tags: input.tags ?? [], status, updatedAt: now };
  if (input.categoryId !== undefined) post.categoryId = input.categoryId;
  if (input.excerpt !== undefined) post.excerpt = input.excerpt;
  if (input.eyecatch !== undefined) post.eyecatch = input.eyecatch;
  if (status === "published") post.publishedAt = input.publishedAt ?? now;
  else if (input.publishedAt !== undefined) post.publishedAt = input.publishedAt;
  return post;
}

/** プレビュー URL を組み立てる（例: https://site/preview/my-post?token=xxx）。 */
export function buildPreviewUrl(baseUrl: string, slug: string, token: string): string {
  const base = baseUrl.replace(/\/$/, "");
  return `${base}/preview/${encodeURIComponent(slug)}?token=${encodeURIComponent(token)}`;
}

/** この入力が「公開」を伴うか（status=published）。公開権限チェックに使う。 */
export function isPublishAction(input: CmsPostInput): boolean {
  return input.status === "published";
}
