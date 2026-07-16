/**
 * 公開サイトのプレビュー（下書き・予約公開を、共有トークン付きで確認する）。
 * 公開中フィルタを通さず、全ステータスの記事を slug で引ける。
 * @packageDocumentation
 */
import { cmsPostToBlog, effectiveStatus, type CmsPost, type BlogView, type EffectiveStatus } from "@platform/cms";
import { siteEnv } from "./env";

/** プレビュー結果。 */
export interface PreviewResult {
  post: BlogView;
  status: EffectiveStatus;
}

/** プレビュートークンが正しいか（環境変数 PREVIEW_TOKEN と一致）。 */
export function isValidPreviewToken(token: string | undefined | null): boolean {
  const expected = siteEnv.PREVIEW_TOKEN;
  if (!expected) return false;
  return typeof token === "string" && token.length > 0 && token === expected;
}

/** 全ステータスの記事から slug で 1 件引き、ブログビュー＋実効ステータスを返す。 */
export function getPreviewPost(posts: CmsPost[], slug: string, now: Date = new Date()): PreviewResult | undefined {
  const post = posts.find((p) => p.slug === slug);
  if (!post) return undefined;
  return { post: cmsPostToBlog(post), status: effectiveStatus(post, now) };
}
