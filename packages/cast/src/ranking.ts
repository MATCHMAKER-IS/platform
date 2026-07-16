/**
 * キャストのランキング(口コミ連動・純ロジック)。
 * 評価と件数を加味した重み付きスコアで並べる。件数の少ない高評価が上位を独占しないよう、
 * ベイズ平均(IMDb 方式)で補正する。口コミ(レビュー)集計は @platform/commerce の ratingSummary と併用可。
 * @packageDocumentation
 */
import { type Cast, activeCasts } from "./cast";

/** ランキング対象のキャスト(評価・件数を持つ)。 */
export interface RankedCast extends Cast {
  /** 平均評価(0〜5)。 */
  rating?: number;
  /** 口コミ件数。 */
  reviewCount?: number;
}

/**
 * ベイズ平均(重み付き評価)を計算する。
 * score = (v/(v+m))*R + (m/(v+m))*C
 *   R=そのキャストの平均, v=件数, m=信頼に足る最小件数, C=全体平均。
 * 件数が少ないほど全体平均に引き寄せられる。
 *
 * **1 件だけ 5 点の人を 1 位にしない**ための仕組み(ベイズ平均)。
 * 「評価が高いのか、たまたま 1 件が良かっただけか」を区別する。
 *
 * @param rating そのキャストの平均評価(R)
 * @param count そのキャストの評価件数(v)
 * @param globalAverage 全体の平均評価(C)
 * @param minCount 信頼できるとみなす件数(m)。**これを下回るほど全体平均に寄る**
 * @returns 重み付きスコア
 */
export function weightedRating(rating: number, reviewCount: number, minCount: number, globalMean: number): number {
  const v = Math.max(0, reviewCount);
  const R = rating;
  const m = Math.max(1, minCount);
  const score = (v / (v + m)) * R + (m / (v + m)) * globalMean;
  return Math.round(score * 1000) / 1000;
}

/**
 * 全キャストの評価を集計する(**件数で重み付け**)。
 *
 * **単純平均だと 1 件だけ 5 点の人が 1 位になる**。件数の少ない評価は信頼できないので、
 * 全体平均に寄せる(ベイズ平均)。
 *
 * @param casts キャストの配列
 * @returns 全体の平均評価
 */
export function globalMeanRating(casts: RankedCast[]): number {
  let totalScore = 0;
  let totalCount = 0;
  for (const c of casts) {
    const count = c.reviewCount ?? 0;
    if (count > 0 && c.rating !== undefined) {
      totalScore += c.rating * count;
      totalCount += count;
    }
  }
  return totalCount > 0 ? totalScore / totalCount : 0;
}

/** ランキング項目。 */
export interface RankingEntry<T> {
  rank: number;
  cast: T;
  /** 重み付きスコア。 */
  score: number;
}

/**
 * 口コミ連動のランキングを作る(在籍中のみ・重み付きスコア降順)。
 *
 * @returns ランキング(**重み付きスコアの降順**。件数の少ない高評価は上位に来ない)
 * @param minCount 信頼に足る最小件数(既定 10)
 */
export function rankCasts<T extends RankedCast>(casts: T[], options: { minCount?: number; limit?: number } = {}): RankingEntry<T>[] {
  const list = activeCasts(casts);
  const minCount = options.minCount ?? 10;
  const mean = globalMeanRating(list);
  const scored = list
    .map((cast) => ({ cast, score: weightedRating(cast.rating ?? 0, cast.reviewCount ?? 0, minCount, mean) }))
    .sort((a, b) => b.score - a.score || (b.cast.reviewCount ?? 0) - (a.cast.reviewCount ?? 0));
  const ranked = scored.map((x, i) => ({ rank: i + 1, cast: x.cast, score: x.score }));
  return options.limit !== undefined ? ranked.slice(0, options.limit) : ranked;
}

/**
 * 単純平均でランキングする(**件数を問わない**)。
 *
 * **1 件だけの満点が上位に来る**ので、公開ランキングには向かない
 * (それでよい場面用。通常は {@link bayesianRanking} を使う)。
 *
 * @param casts キャストの配列
 * @returns 平均評価の降順。**同点なら件数の多い順**
 */
export function rankByRawRating<T extends RankedCast>(casts: T[], limit?: number): RankingEntry<T>[] {
  const ranked = activeCasts(casts)
    .slice()
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || (b.reviewCount ?? 0) - (a.reviewCount ?? 0))
    .map((cast, i) => ({ rank: i + 1, cast, score: cast.rating ?? 0 }));
  return limit !== undefined ? ranked.slice(0, limit) : ranked;
}
