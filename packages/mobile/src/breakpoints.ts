/**
 * レスポンシブのブレークポイント判定(純ロジック)。
 * 画面幅から現在のブレークポイント名を求める。Tailwind 既定に合わせている。
 * @packageDocumentation
 */

/** ブレークポイント定義(名前 → 最小幅 px)。昇順であること。 */
export type Breakpoints = Record<string, number>;

/** 既定のブレークポイント(Tailwind 準拠)。 */
export const DEFAULT_BREAKPOINTS: Breakpoints = { xs: 0, sm: 640, md: 768, lg: 1024, xl: 1280, "2xl": 1536 };

/**
 * 画面幅からブレークポイント名を返す。
 *
 * @param width 画面幅
 * @param breakpoints ブレークポイントの定義
 * @returns 該当する**最大の**閾値の名前
 */
export function matchBreakpoint(width: number, breakpoints: Breakpoints = DEFAULT_BREAKPOINTS): string {
  const sorted = Object.entries(breakpoints).sort((a, b) => a[1] - b[1]);
  let current = sorted[0]?.[0] ?? "xs";
  for (const [name, min] of sorted) {
    if (width >= min) current = name;
    else break;
  }
  return current;
}

/** 端末カテゴリ(幅ベースのざっくり分類)。 */
export type DeviceSize = "mobile" | "tablet" | "desktop";

/**
 * 幅から端末カテゴリを返す。
 *
 * **あくまで幅での推定**(タッチかどうかは {@link isTouchPrimary} で見る)。
 *
 * @param width 画面幅
 * @returns `mobile`(<768)/ `tablet`(<1024)/ `desktop`
 */
export function deviceSizeFromWidth(width: number, options?: { tabletMin?: number; desktopMin?: number }): DeviceSize {
  const tabletMin = options?.tabletMin ?? 768;
  const desktopMin = options?.desktopMin ?? 1024;
  if (width < tabletMin) return "mobile";
  if (width < desktopMin) return "tablet";
  return "desktop";
}

/**
 * 指定したブレークポイント以上かを判定する。
 *
 * @param width 画面幅
 * @param name ブレークポイント名
 * @param breakpoints 定義
 * @returns 以上なら true
 */
export function isBreakpointUp(width: number, name: string, breakpoints: Breakpoints = DEFAULT_BREAKPOINTS): boolean {
  const min = breakpoints[name];
  return min !== undefined && width >= min;
}
