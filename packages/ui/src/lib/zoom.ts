/**
 * 画像ズームの純ロジック(描画を含まない)。
 *
 * 業務では**添付画像を細部まで確認したい**場面が多い(領収書の但し書き、図面の寸法、
 * 現場写真の傷)。ダウンロードして別アプリで開かせるのは手間なので、画面で拡大できるようにする。
 * @packageDocumentation
 */

/** 拡大率と位置。 */
export interface ZoomState {
  /** 拡大率(1 = 等倍)。 */
  scale: number;
  /** 横のずらし幅(px・表示座標)。 */
  x: number;
  /** 縦のずらし幅(px・表示座標)。 */
  y: number;
}

/** ズームの制限。 */
export interface ZoomLimits {
  /** 最小の拡大率(既定 1 = 縮小しない)。 */
  min?: number;
  /** 最大の拡大率(既定 8)。 */
  max?: number;
}

/** 等倍・中央の初期状態。 */
export const ZOOM_RESET: ZoomState = { scale: 1, x: 0, y: 0 };

/**
 * 拡大率を制限内に収める。
 *
 * @param scale 希望の拡大率
 * @param limits 制限
 * @returns 制限内の拡大率
 */
export function clampScale(scale: number, limits: ZoomLimits = {}): number {
  const { min = 1, max = 8 } = limits;
  if (!Number.isFinite(scale)) return min;
  return Math.min(max, Math.max(min, scale));
}

/**
 * ずらし幅を「画像が枠から離れない」範囲に収める。
 *
 * @remarks
 * **等倍以下では常に中央(0, 0)**。拡大していないのに動かせると、
 * 「画像が消えた」と言われる。拡大時のみ、はみ出した分だけ動かせる。
 *
 * @param state 現在の状態
 * @param viewW 表示枠の幅
 * @param viewH 表示枠の高さ
 * @returns 収めた状態
 */
export function clampPan(state: ZoomState, viewW: number, viewH: number): ZoomState {
  if (state.scale <= 1) return { scale: state.scale, x: 0, y: 0 };
  // 拡大ではみ出した量の半分ずつが、上下左右に動かせる幅
  const maxX = (viewW * (state.scale - 1)) / 2;
  const maxY = (viewH * (state.scale - 1)) / 2;
  return {
    scale: state.scale,
    x: Math.min(maxX, Math.max(-maxX, state.x)),
    y: Math.min(maxY, Math.max(-maxY, state.y)),
  };
}

/**
 * ホイール/ピンチで拡大する。**カーソル位置を中心に**寄る。
 *
 * @remarks
 * **枠の中心ではなくカーソル位置を基準にするのが要点。**
 * 中心基準だと、見たい箇所が画面外へ逃げていく。
 *
 * @param state 現在の状態
 * @param factor 倍率(1.1 なら 10% 拡大 / 0.9 なら縮小)
 * @param cursor 枠の中心からのカーソル位置(px)
 * @param view 表示枠のサイズ
 * @param limits 制限
 * @returns 新しい状態(制限済み)
 */
export function zoomAt(
  state: ZoomState,
  factor: number,
  cursor: { x: number; y: number },
  view: { width: number; height: number },
  limits: ZoomLimits = {},
): ZoomState {
  const next = clampScale(state.scale * factor, limits);
  if (next === state.scale) return state;
  // カーソル位置が同じ画素を指し続けるよう、ずらし幅を補正する
  const ratio = next / state.scale;
  const nx = cursor.x - (cursor.x - state.x) * ratio;
  const ny = cursor.y - (cursor.y - state.y) * ratio;
  return clampPan({ scale: next, x: nx, y: ny }, view.width, view.height);
}

/**
 * 画像を枠に「収める」拡大率を求める(contain 相当)。
 *
 * @param natural 画像の実寸
 * @param view 表示枠のサイズ
 * @returns 拡大率。**枠より小さい画像は 1**(拡大しない)
 */
export function fitScale(natural: { width: number; height: number }, view: { width: number; height: number }): number {
  if (natural.width <= 0 || natural.height <= 0) return 1;
  const s = Math.min(view.width / natural.width, view.height / natural.height);
  return Number.isFinite(s) ? Math.min(1, s) : 1;
}

/**
 * 拡大率を表示用の文字列にする。
 *
 * @param scale 拡大率(1 = 等倍)
 * @returns `120%` の形(小数は四捨五入)
 */
export function formatScale(scale: number): string {
  return `${Math.round(scale * 100)}%`;
}
