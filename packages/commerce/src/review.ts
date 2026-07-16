/**
 * レビュー・評価の集計(純ロジック)。
 * 星評価(1〜5)の平均・分布・パーセンテージを出す。商品/記事の評価表示に。
 * @packageDocumentation
 */

/** 評価の分布(星ごとの件数)。 */
export type RatingDistribution = Record<1 | 2 | 3 | 4 | 5, number>;

/**
 * 平均評価を返す。
 *
 * @param reviews レビューの配列
 * @returns 平均(**小数第 1 位に丸め**)。**件数 0 なら 0**
 */
export function averageRating(ratings: number[]): number {
  if (ratings.length === 0) return 0;
  const sum = ratings.reduce((s, r) => s + r, 0);
  return Math.round((sum / ratings.length) * 10) / 10;
}

/**
 * 星ごとの件数を数える。
 *
 * **分布を見せる**と、平均だけより実態が伝わる(平均 3.0 でも、
 * 「全部 3」と「5 と 1 が半々」では意味が違う)。
 *
 * @param reviews レビューの配列
 * @returns 1〜5 それぞれの件数(**範囲外の評価は無視**)
 */
export function ratingDistribution(ratings: number[]): RatingDistribution {
  const dist: RatingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of ratings) {
    const star = Math.round(r);
    if (star >= 1 && star <= 5) dist[star as 1 | 2 | 3 | 4 | 5]++;
  }
  return dist;
}

/** 評価サマリ。 */
export interface RatingSummary {
  average: number;
  count: number;
  distribution: RatingDistribution;
  /** 星ごとの割合(%・全体に対する)。 */
  percentages: Record<1 | 2 | 3 | 4 | 5, number>;
}

/**
 * 評価の要約を作る。
 *
 * @param reviews レビューの配列
 * @returns 平均・件数・分布・割合(**そのまま描画できる形**)
 */
export function ratingSummary(ratings: number[]): RatingSummary {
  const distribution = ratingDistribution(ratings);
  const count = ratings.length;
  const percentages = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<1 | 2 | 3 | 4 | 5, number>;
  if (count > 0) {
    for (const star of [1, 2, 3, 4, 5] as const) {
      percentages[star] = Math.round((distribution[star] / count) * 1000) / 10;
    }
  }
  return { average: averageRating(ratings), count, distribution, percentages };
}
