/**
 * 散布図の純ロジック(回帰直線)。**描画を含まない**ので、サーバでも画面でも使える。
 *
 * 社内業務では「残業時間と不具合件数」「気温と来店数」「単価と受注率」のように、
 * **2 つの数値の関係を見たい**場面で使う。
 * @packageDocumentation
 */
import { linearRegressionXY, type LinearFit } from "@platform/utils";

/**
 * 回帰の入力になる点。
 *
 * @remarks
 * `ScatterSeries["points"]` をそのまま渡せる形にしてある。
 * **`components/scatter.tsx` の `ScatterPoint` とは別物**(あちらは z を持たない)なので、
 * 名前を分けている。同名にするとバレルで衝突する。
 */
export interface RegressionInput {
  x: number;
  y: number;
  z?: number;
}

/** {@link regressionLine} の戻り値。 */
export interface RegressionLine {
  /** 直線を引くための 2 点(x の最小・最大)。**そのままチャートの系列に渡せる**。 */
  points: { x: number; y: number }[];
  /** 傾き。 */
  slope: number;
  /** 切片。 */
  intercept: number;
  /** 決定係数。**1 に近いほど当てはまりが良い**。 */
  r2: number;
  /** `y = 1.23x + 4.56` の形。凡例やラベルに使う。 */
  equation: string;
}

/**
 * 点群から回帰直線を求める。
 *
 * @remarks
 * **点が 2 未満、または x が全て同じなら `null`。** 直線が引けないため。
 * 「1 点しか無いのに直線を引く」「垂直な直線を引く」を防ぐ。
 *
 * 返す `points` は **x の最小と最大の 2 点だけ**。回帰直線は直線なので、
 * 端点さえあればチャート側が繋いでくれる(全点を計算する必要はない)。
 *
 * @param points 点群
 * @param digits 式に出す小数桁(既定 2)
 * @returns 回帰直線。**引けなければ null**
 * @example
 * ```ts
 * const line = regressionLine([{ x: 1, y: 2 }, { x: 2, y: 4 }, { x: 3, y: 6 }]);
 * line?.equation  // "y = 2x + 0"
 * line?.r2        // 1(完全に一直線)
 * ```
 */
export function regressionLine(points: readonly RegressionInput[], digits = 2): RegressionLine | null {
  if (points.length < 2) return null;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  // x が全て同じ = 垂直。最小二乗法では表せない。
  if (minX === maxX) return null;

  const fit: LinearFit = linearRegressionXY(xs, ys);
  const round = (n: number) => Number(n.toFixed(digits));
  const a = round(fit.slope);
  const b = round(fit.intercept);
  return {
    points: [
      { x: minX, y: fit.slope * minX + fit.intercept },
      { x: maxX, y: fit.slope * maxX + fit.intercept },
    ],
    slope: fit.slope,
    intercept: fit.intercept,
    r2: fit.r2,
    // 符号は半角に統一する。傾きは toFixed が "-2" を返すので、切片だけ全角にすると混在する。
    equation: `y = ${a}x ${b < 0 ? "-" : "+"} ${Math.abs(b)}`,
  };
}

/**
 * R² を人が読める強さに変える。
 *
 * @remarks
 * **数字だけ出しても伝わらない。** 「R²=0.42」と言われて判断できる人は限られる。
 * 目安は慣用的なもので、分野によって基準は違う(社会科学では 0.3 でも十分なことがある)。
 *
 * @param r2 決定係数
 * @returns `強い` / `中程度` / `弱い` / `ほぼ無し`
 */
export function fitStrength(r2: number): "強い" | "中程度" | "弱い" | "ほぼ無し" {
  if (r2 >= 0.7) return "強い";
  if (r2 >= 0.4) return "中程度";
  if (r2 >= 0.16) return "弱い";
  return "ほぼ無し";
}
