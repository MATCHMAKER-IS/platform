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

/**
 * slug が妥当かを判定する(英小文字・数字・ハイフン)。
 *
 * **URL の一部になる**ので、大文字・日本語・記号を許すと環境によって壊れる。
 *
 * @param slug 判定する slug
 * @returns 妥当なら true
 */
export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

/**
 * 記事の入力を検証する。
 *
 * @param input 入力
 * @returns 問題の一覧(**空なら妥当**)。フィールド名と理由を返すので、画面でそのまま出せる
 */
export function validatePostInput(input: CmsPostInput): { ok: true; value: CmsPostInput } | { ok: false; error: string } {
  if (!input.slug || !isValidSlug(input.slug)) return { ok: false, error: "slug は英小文字・数字・ハイフンで指定してください" };
  if (!input.title.trim()) return { ok: false, error: "タイトルは必須です" };
  if (!input.body.trim()) return { ok: false, error: "本文は必須です" };
  if (input.publishedAt !== undefined && isNaN(new Date(input.publishedAt).getTime())) return { ok: false, error: "公開日時が不正です" };
  return { ok: true, value: input };
}

/**
 * 入力を記事(CmsPost)に変換する。
 *
 * **公開時は `publishedAt` を確定させる**(その瞬間を記録)。
 * 予約公開なら、指定された予約日時をそのまま使う。
 *
 * @param input 入力
 * @param now 現在時刻(テスト注入用)
 * @returns 保存できる形の記事
 */
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

/**
 * プレビュー URL を組み立てる。
 *
 * **未公開の記事を関係者に見せる**ため。トークンで認証するので、
 * URL を知っている人だけが見られる(**トークンは推測できない値にすること**)。
 *
 * @param baseUrl サイトの URL
 * @param slug 記事の slug
 * @param token プレビュー用のトークン
 * @returns プレビュー URL
 */
export function buildPreviewUrl(baseUrl: string, slug: string, token: string): string {
  const base = baseUrl.replace(/\/$/, "");
  return `${base}/preview/${encodeURIComponent(slug)}?token=${encodeURIComponent(token)}`;
}

/**
 * この入力が「公開」を伴うかを判定する。
 *
 * **公開の権限チェックに使う**(下書き保存は誰でも、公開は権限者のみ、といった制御)。
 *
 * @param input 入力
 * @returns 公開を伴うなら true
 */
export function isPublishAction(input: CmsPostInput): boolean {
  return input.status === "published";
}
