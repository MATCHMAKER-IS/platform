/**
 * アニメーション/パララックスの純粋ヘルパー（イージング・オフセット計算・プリセット）。
 * @packageDocumentation
 */

/** イージング関数（0–1 → 0–1）。 */
export const easing = {
  linear: (t: number) => t,
  easeInQuad: (t: number) => t * t,
  easeOutQuad: (t: number) => t * (2 - t),
  easeInOutQuad: (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  easeInCubic: (t: number) => t * t * t,
  easeOutCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  easeInOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
} as const;

/**
 * 0–1 に丸める。
 *
 * @param value 値
 * @returns 0–1 の値
 */
export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * パララックスのオフセット（px）を計算する。
 * speed > 0 で背景がゆっくり動く（要素が画面中央にあるとき 0）。
 *
 * @param progress スクロール進捗(0–1)
 * @param distance 移動量
 * @returns オフセット(**背景をゆっくり動かす**と奥行きが出る)
 */
export function parallaxOffset(scrollY: number, elementTop: number, viewportHeight: number, speed: number): number {
  // 要素の中心が画面中央に来たときを基準（0）にした相対移動量
  const elementCenter = elementTop + viewportHeight / 2;
  const viewportCenter = scrollY + viewportHeight / 2;
  return (viewportCenter - elementCenter) * speed;
}

/**
 * スクロール進捗を返す(要素が入ってから出るまでを 0→1)。
 *
 * **視差効果やスクロール連動アニメーション**に使う。
 *
 * @param rect 要素の位置
 * @param viewportHeight 表示領域の高さ
 * @returns 0–1 の進捗
 */
export function scrollProgress(scrollY: number, elementTop: number, elementHeight: number, viewportHeight: number): number {
  const start = elementTop - viewportHeight;
  const end = elementTop + elementHeight;
  if (end === start) return 0;
  return clamp01((scrollY - start) / (end - start));
}

/** CSS トランジションのプリセット文字列。 */
export const transitionPresets = {
  fast: "all 150ms cubic-bezier(0.4, 0, 0.2, 1)",
  base: "all 250ms cubic-bezier(0.4, 0, 0.2, 1)",
  slow: "all 400ms cubic-bezier(0.4, 0, 0.2, 1)",
  spring: "all 500ms cubic-bezier(0.34, 1.56, 0.64, 1)",
} as const;

/**
 * フェード・スライドインのスタイルを返す。
 *
 * **`IntersectionObserver` と併用**する(画面に入ったら最終スタイルに切り替える)。
 * **CSS の transition に任せる**ので、JS でフレームを回さない(軽い)。
 *
 * @param options.direction 方向
 * @param options.distance 移動量
 * @returns 初期と最終のスタイル
 */
export function revealStyle(visible: boolean, options: { distance?: number; axis?: "y" | "x" } = {}): { opacity: number; transform: string } {
  const distance = options.distance ?? 16;
  const axis = options.axis ?? "y";
  if (visible) return { opacity: 1, transform: "translate(0, 0)" };
  return { opacity: 0, transform: axis === "y" ? `translate(0, ${distance}px)` : `translate(${distance}px, 0)` };
}
