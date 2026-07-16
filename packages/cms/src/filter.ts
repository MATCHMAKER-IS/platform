/**
 * 記事の検索・絞り込み（純関数）。CMS 一覧の検索窓・フィルタで使う。
 * @packageDocumentation
 */
import { type CmsPost } from "./model.js";
import { effectiveStatus, type EffectiveStatus } from "./scheduling.js";

/** 絞り込み条件。 */
export interface PostFilter {
  /** タイトル・抜粋・本文・タグを対象にした部分一致（大文字小文字無視）。 */
  query?: string;
  /** カテゴリ ID の完全一致。 */
  categoryId?: string;
  /** タグの完全一致。 */
  tag?: string;
  /** 実効ステータス。 */
  status?: EffectiveStatus;
}

/**
 * 条件に合う記事だけを返す。
 *
 * 指定しなかった条件は無視される(AND 条件)。**元の順序を保つ**。
 *
 * @param posts 記事の配列
 * @param filter 絞り込み条件(状態・タグ・カテゴリ・キーワードなど)
 * @returns 条件に合う記事
 */
export function filterPosts(posts: CmsPost[], filter: PostFilter, now: Date = new Date()): CmsPost[] {
  const q = filter.query?.trim().toLowerCase();
  return posts.filter((p) => {
    if (filter.categoryId && p.categoryId !== filter.categoryId) return false;
    if (filter.tag && !p.tags.includes(filter.tag)) return false;
    if (filter.status && effectiveStatus(p, now) !== filter.status) return false;
    if (q) {
      const hay = `${p.title} ${p.excerpt ?? ""} ${p.body} ${p.tags.join(" ")}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}
