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

/** 公開(在籍中)のキャストだけを返す。 */
export function activeCasts<T extends Cast>(casts: T[]): T[] {
  return casts.filter((c) => c.status === "active");
}

/** タグで絞り込む(いずれかのタグを含む)。 */
export function castsByTag<T extends Cast>(casts: T[], tag: string): T[] {
  return casts.filter((c) => c.tags?.includes(tag));
}

/** 指定タグをすべて含むキャストを返す。 */
export function castsByAllTags<T extends Cast>(casts: T[], tags: string[]): T[] {
  return casts.filter((c) => tags.every((t) => c.tags?.includes(t)));
}

/** 全キャストのタグ出現数を集計する(多い順)。 */
export function tagCounts(casts: Cast[]): { tag: string; count: number }[] {
  const map = new Map<string, number>();
  for (const c of casts) for (const t of c.tags ?? []) map.set(t, (map.get(t) ?? 0) + 1);
  return [...map.entries()].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count);
}

/** 入店から指定日数以内なら新人とみなす。 */
export function isNewcomer(cast: Cast, withinDays = 30, now: Date = new Date()): boolean {
  if (!cast.joinedAt) return false;
  const days = (now.getTime() - new Date(cast.joinedAt).getTime()) / 86_400_000;
  return days >= 0 && days <= withinDays;
}

/** 新人キャストを入店日の新しい順で返す。 */
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
 */
export function sortCasts<T extends Cast>(casts: T[], sort: CastSort = "featured", now: Date = new Date()): T[] {
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

/** 注目キャストを返す(featured フラグ・評価順)。 */
export function featuredCasts<T extends Cast>(casts: T[], limit?: number): T[] {
  const list = activeCasts(casts)
    .filter((c) => c.featured)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  return limit !== undefined ? list.slice(0, limit) : list;
}
