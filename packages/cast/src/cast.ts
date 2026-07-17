/**
 * キャスト(スタッフ/タレント)の一覧・絞り込み・並び替え(純ロジック)。
 * 在籍状態、タグ(得意分野・特徴)での絞り込み、注目/新人/評価順の並び替え。
 * SNS 連携は @platform/social、予約の空きは @platform/booking と組み合わせる。
 * @packageDocumentation
 */

/** キャストの在籍状態。 */
export type CastStatus = "active" | "hidden" | "retired";

/** キャスト(基盤が扱う最小限のフィールド)。 */
export interface Cast {
  id: string;
  /** 表示名。 */
  name: string;
  status: CastStatus;
  /** 得意分野・特徴などのタグ。 */
  tags?: string[];
  /** 注目キャストとして優先表示するか。 */
  featured?: boolean;
  /** 入店日(ISO 日付・新人判定に使う)。 */
  joinedAt?: string;
  /** 平均評価(0〜5)。 */
  rating?: number;
  [key: string]: unknown;
}

/**
 * 公開(在籍中)のキャストだけを返す。
 *
 * **一覧を返す前に必ず通す**。退店した人が公開サイトに残ると問題になる。
 *
 * @param casts キャストの配列
 * @returns 在籍中で公開設定のキャスト
 */
export function activeCasts<T extends Cast>(casts: T[]): T[] {
  return casts.filter((c) => c.status === "active");
}

/**
 * タグで絞り込む(**いずれかを含む** = OR 条件)。
 *
 * @param casts キャストの配列
 * @param tags 絞り込むタグ
 * @returns いずれかのタグを持つキャスト
 */
export function castsByTag<T extends Cast>(casts: T[], tag: string): T[] {
  return casts.filter((c) => c.tags?.includes(tag));
}

/**
 * 指定したタグを**すべて含む**キャストを返す(AND 条件)。
 *
 * @param casts キャストの配列
 * @param tags 絞り込むタグ
 * @returns すべてのタグを持つキャスト
 */
export function castsByAllTags<T extends Cast>(casts: T[], tags: string[]): T[] {
  return casts.filter((c) => tags.every((t) => c.tags?.includes(t)));
}

/**
 * タグの出現数を集計する(タグクラウド・絞り込み UI 用)。
 *
 * @param casts キャストの配列
 * @returns タグと件数(**多い順**)
 */
export function tagCounts(casts: Cast[]): { tag: string; count: number }[] {
  const map = new Map<string, number>();
  for (const c of casts) for (const t of c.tags ?? []) map.set(t, (map.get(t) ?? 0) + 1);
  return [...map.entries()].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count);
}

/**
 * 新人かを判定する(入店から指定日数以内)。
 *
 * @param cast キャスト
 * @param days 新人とみなす日数(既定 90)
 * @param now 基準日(テスト注入用)
 * @returns 新人なら true。**入店日が無ければ false**
 */
export function isNewcomer(cast: Cast, withinDays = 30, now: Date = new Date()): boolean {
  if (!cast.joinedAt) return false;
  const days = (now.getTime() - new Date(cast.joinedAt).getTime()) / 86_400_000;
  return days >= 0 && days <= withinDays;
}

/**
 * 新人のキャストを返す。
 *
 * @param casts キャストの配列
 * @param days 新人とみなす日数(既定 90)
 * @param now 基準日(テスト注入用)
 * @returns 新人(**入店日の新しい順**)
 */
export function newcomers<T extends Cast>(casts: T[], withinDays = 30, now: Date = new Date()): T[] {
  return activeCasts(casts)
    .filter((c) => isNewcomer(c, withinDays, now))
    .sort((a, b) => new Date(b.joinedAt ?? 0).getTime() - new Date(a.joinedAt ?? 0).getTime());
}

/** キャストの並び替え基準。 */
export type CastSort = "featured" | "rating" | "newest" | "name";

/**
 * キャストを並び替える。featured は 注目→評価順、rating は評価降順、newest は入店日降順、name は名前順。
 * 在籍中のみを対象にする。
 *
 * @param casts キャストの配列
 * @param order 並び順(`featured` / `rating` / `newest` / `name`)
 * @returns 並べ替えた新しい配列(**在籍中のみ**)
 */
export function sortCasts<T extends Cast>(casts: T[], sort: CastSort = "featured", _now: Date = new Date()): T[] {
  const list = activeCasts(casts);
  switch (sort) {
    case "featured":
      return [...list].sort((a, b) => Number(b.featured ?? false) - Number(a.featured ?? false) || (b.rating ?? 0) - (a.rating ?? 0));
    case "rating":
      return [...list].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    case "newest":
      return [...list].sort((a, b) => new Date(b.joinedAt ?? 0).getTime() - new Date(a.joinedAt ?? 0).getTime());
    case "name":
      return [...list].sort((a, b) => a.name.localeCompare(b.name, "ja"));
  }
}

/**
 * 注目キャストを返す(featured フラグが立っているもの)。
 *
 * **トップページの目玉**。手で選んだ人を、評価順で並べる。
 *
 * @param casts キャストの配列
 * @param limit 件数(既定 6)
 * @returns 注目キャスト(評価の高い順)
 */
export function featuredCasts<T extends Cast>(casts: T[], limit?: number): T[] {
  const list = activeCasts(casts)
    .filter((c) => c.featured)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  return limit !== undefined ? list.slice(0, limit) : list;
}
