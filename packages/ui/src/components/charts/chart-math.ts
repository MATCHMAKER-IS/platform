/**
 * チャート系の純粋な計算(検証しやすいよう UI から分離)。
 * @packageDocumentation
 */

/** ローソク足 1 本の OHLC。 */
export interface Candle { open: number; high: number; low: number; close: number }

/**
 * ローソク足の描画座標を計算する。
 * @param c OHLC
 * @param x バーの左端 px、width バー幅
 * @param y 高値(high)の px、height 高値〜安値の px 高さ
 */
export function candleGeometry(c: Candle, x: number, width: number, y: number, height: number) {
  const range = c.high - c.low;
  const pxPerVal = range === 0 ? 0 : height / range;
  const toPx = (v: number) => y + (c.high - v) * pxPerVal;
  const openPx = toPx(c.open);
  const closePx = toPx(c.close);
  const bodyY = Math.min(openPx, closePx);
  const bodyH = Math.max(1, Math.abs(closePx - openPx));
  return {
    cx: x + width / 2,
    wickY: y, wickH: height,
    bodyX: x + width * 0.2, bodyW: width * 0.6, bodyY, bodyH,
    up: c.close >= c.open,
  };
}

/**
 * 各行を合計 100% に正規化する(帯グラフ用)。
 *
 * **構成比の推移を見る**のに使う(実数だと全体の増減に紛れて、割合の変化が見えない)。
 *
 * @param rows 行ごとの系列値
 * @returns 各行が 100% になるよう正規化した値。**合計 0 の行は全て 0**
 */
export function toPercentStacked<T extends Record<string, unknown>>(data: T[], keys: string[]): T[] {
  return data.map((row) => {
    const total = keys.reduce((s, k) => s + (Number(row[k]) || 0), 0) || 1;
    const out = { ...row } as Record<string, unknown>;
    for (const k of keys) out[k] = ((Number(row[k]) || 0) / total) * 100;
    return out as T;
  });
}

/** ヒストグラムのビン。 */
export interface HistBin { label: string; count: number; x0: number; x1: number }

/**
 * 数値を等幅のビンに分ける(ヒストグラム用)。
 *
 * @param values 数値の配列
 * @param binCount ビンの数
 * @returns 各ビンの範囲と件数(**最後のビンだけ上端を含む**。でないと最大値がどこにも入らない)
 */
export function histogramBins(values: number[], binCount = 10): HistBin[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const width = (max - min) / binCount || 1;
  const bins: HistBin[] = Array.from({ length: binCount }, (_v, i) => ({
    x0: min + i * width, x1: min + (i + 1) * width, count: 0, label: "",
  }));
  for (const v of values) {
    let idx = Math.floor((v - min) / width);
    if (idx >= binCount) idx = binCount - 1;
    if (idx < 0) idx = 0;
    bins[idx]!.count++;
  }
  return bins.map((b) => ({ ...b, label: `${Math.round(b.x0)}–${Math.round(b.x1)}` }));
}

/** ウォーターフォールの入力項目。 */
export interface WaterfallItem {
  label: string;
  value: number;
  /** "total" は基準線(0)からの絶対値バー(小計/合計)。省略時は増減(delta)。 */
  type?: "delta" | "total";
}

/** ウォーターフォールの 1 行(積み上げ横棒用: 透明 offset + 実体 bar)。 */
export interface WaterfallRow {
  label: string;
  offset: number;
  bar: number;
  value: number;
  kind: "increase" | "decrease" | "total";
  cumulative: number;
}

/**
 * 増減項目を滝グラフ用に変換する。
 *
 * **「前期からどう変わって今期になったか」を見せる**(売上 100 → +30 → -10 → 120)。
 * 各バーの浮き位置(offset)を計算する。
 *
 * @param items 増減項目
 * @returns 各バーの offset と高さ
 */
export function toWaterfall(items: WaterfallItem[]): WaterfallRow[] {
  let running = 0;
  return items.map((it) => {
    let start: number, end: number, kind: WaterfallRow["kind"];
    if (it.type === "total") {
      start = 0; end = it.value; running = it.value; kind = "total";
    } else {
      start = running; end = running + it.value; running = end;
      kind = it.value >= 0 ? "increase" : "decrease";
    }
    return { label: it.label, offset: Math.min(start, end), bar: Math.abs(end - start), value: it.value, kind, cumulative: running };
  });
}

/**
 * 極座標を直交座標にする。
 *
 * **0° は真上・時計回り**(数学の慣習とは違う)。円グラフは 12 時から
 * 時計回りに描くのが一般的なので、それに合わせてある。
 *
 * @param cx / cy 中心
 * @param radius 半径
 * @param angleDeg 角度(**度**。0 = 真上)
 * @returns `{ x, y }`
 */
export function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number): { x: number; y: number } {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

/**
 * 円弧の SVG パスを作る。
 *
 * @param cx / cy 中心
 * @param radius 半径
 * @param startAngle / endAngle 角度(度)
 * @returns SVG の `d` 属性の値
 */
export function arcPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const s = polarToCartesian(cx, cy, r, endAngle);
  const e = polarToCartesian(cx, cy, r, startAngle);
  const large = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 0 ${e.x} ${e.y}`;
}

/**
 * 進捗リングの `stroke-dashoffset` を計算する。
 *
 * **円周を破線として扱い、見せる長さを変える**のが定石(SVG で弧を描くより簡単)。
 *
 * @param radius 半径
 * @param progress 進捗(0–1)
 * @returns `stroke-dashoffset` の値
 */
export function ringDashOffset(progress: number, radius: number): number {
  const p = Math.max(0, Math.min(1, progress));
  return 2 * Math.PI * radius * (1 - p);
}
