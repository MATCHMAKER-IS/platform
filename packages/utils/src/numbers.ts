/**
 * 数値ユーティリティ(純関数)。丸め・範囲・補間・整形・パース・統計など。
 * @packageDocumentation
 */

// ───────────────────────── 範囲・補間 ─────────────────────────

/** min〜max に収める。 */
export function clamp(n: number, min: number, max: number): number {
  return n < min ? min : n > max ? max : n;
}

/** min〜max の範囲内か(両端含む)。 */
export function inRange(n: number, min: number, max: number): boolean {
  return n >= min && n <= max;
}

/** 線形補間(t=0→a, t=1→b)。 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** 0〜1 に正規化する。min===max のとき 0。 */
export function normalize(n: number, min: number, max: number): number {
  return max === min ? 0 : (n - min) / (max - min);
}

/** ある範囲の値を別の範囲へ写像する。 */
export function mapRange(n: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
  return outMin + (outMax - outMin) * normalize(n, inMin, inMax);
}

// ───────────────────────── 丸め ─────────────────────────

/** 指定小数桁で四捨五入(浮動小数の誤差に強い実装)。 */
export function round(n: number, decimals = 0): number {
  if (!Number.isFinite(n)) return n;
  const m = Number(`${n}e${decimals}`);
  return Number(`${Math.round(m)}e${-decimals}`);
}

/** 指定小数桁で切り上げ。 */
export function ceilTo(n: number, decimals = 0): number {
  const f = 10 ** decimals;
  return Math.ceil(n * f) / f;
}

/** 指定小数桁で切り捨て。 */
export function floorTo(n: number, decimals = 0): number {
  const f = 10 ** decimals;
  return Math.floor(n * f) / f;
}

/** step の倍数へ丸める(例: 5 単位)。 */
export function roundToStep(n: number, step: number): number {
  if (step === 0) return n;
  return Math.round(n / step) * step;
}

/** 銀行丸め(偶数丸め)。0.5 は最近接の偶数へ。 */
export function roundHalfEven(n: number, decimals = 0): number {
  const f = 10 ** decimals;
  const x = n * f;
  const r = Math.round(x);
  // ちょうど 0.5 の差なら偶数へ
  if (Math.abs(x - Math.trunc(x) - 0.5) < Number.EPSILON * 4 || Math.abs(x - Math.trunc(x) + 0.5) < Number.EPSILON * 4) {
    const floor = Math.floor(x);
    const even = floor % 2 === 0 ? floor : floor + 1;
    return even / f;
  }
  return r / f;
}

/** 小数を切り捨てて指定桁に(round と違い常に 0 方向)。 */
export function truncateDecimals(n: number, decimals = 0): number {
  const f = 10 ** decimals;
  return Math.trunc(n * f) / f;
}

// ───────────────────────── 整形 ─────────────────────────

/** {@link formatNumber} のオプション。 */
export interface FormatNumberOptions { decimals?: number; thousandsSep?: string; decimalSep?: string }

/** 桁区切り整形。decimals 指定で小数桁固定。 */
export function formatNumber(n: number, options: FormatNumberOptions = {}): string {
  const { decimals, thousandsSep = ",", decimalSep = "." } = options;
  if (!Number.isFinite(n)) return String(n);
  const abs = Math.abs(n);
  const s = decimals != null ? round(abs, decimals).toFixed(decimals) : String(abs);
  const [intPart, fracPart] = s.split(".");
  const grouped = (intPart ?? "0").replace(/\B(?=(\d{3})+(?!\d))/g, thousandsSep);
  return (n < 0 ? "-" : "") + grouped + (fracPart ? decimalSep + fracPart : "");
}

/** 比率(0.25)をパーセント文字列("25%")に。value がすでに % なら ratio=false。 */
export function formatPercent(value: number, decimals = 0, options: { ratio?: boolean } = {}): string {
  const ratio = options.ratio ?? true;
  const pct = ratio ? value * 100 : value;
  return `${round(pct, decimals).toFixed(decimals)}%`;
}

/** 短縮表記(1.2K / 3.4M / 5.6B / 7.8T)。 */
export function formatCompact(n: number, decimals = 1): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  const units: Array<[number, string]> = [[1e12, "T"], [1e9, "B"], [1e6, "M"], [1e3, "K"]];
  for (const [threshold, suffix] of units) {
    if (abs >= threshold) return sign + trimZeros(round(abs / threshold, decimals)) + suffix;
  }
  return sign + trimZeros(round(abs, decimals));
}

/** 日本語の万/億/兆表記(例: 12345 → "1.2万")。 */
export function formatManOku(n: number, decimals = 1): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  const units: Array<[number, string]> = [[1e12, "兆"], [1e8, "億"], [1e4, "万"]];
  for (const [threshold, suffix] of units) {
    if (abs >= threshold) return sign + trimZeros(round(abs / threshold, decimals)) + suffix;
  }
  return sign + trimZeros(round(abs, decimals));
}

/** バイト数を人間可読に(1024 基準)。 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return "0 B";
  const sign = bytes < 0 ? "-" : "";
  const abs = Math.abs(bytes);
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(abs) / Math.log(1024)));
  return sign + trimZeros(round(abs / 1024 ** i, decimals)) + " " + units[i];
}

function trimZeros(n: number): string {
  return String(n);
}

// ───────────────────────── パース ─────────────────────────

/** 文字列を数値へ(全角・カンマ・通貨記号・% を除去)。失敗時 NaN。 */
export function parseNumber(input: string): number {
  if (typeof input !== "string") return NaN;
  const half = input
    .replace(/[\uff10-\uff19]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0))
    .replace(/，/g, ",").replace(/．/g, ".").replace(/　/g, " ");
  const cleaned = half.replace(/[,\s¥$€£%]/g, "").replace(/(?!^-)[^\d.]/g, "");
  if (cleaned === "" || cleaned === "-" || cleaned === ".") return NaN;
  const n = Number(cleaned);
  return Number.isNaN(n) ? NaN : n;
}

/** parseNumber の失敗時にフォールバックを返す版。 */
export function parseNumberOr(input: string, fallback: number): number {
  const n = parseNumber(input);
  return Number.isNaN(n) ? fallback : n;
}

// ───────────────────────── 計算補助 ─────────────────────────

/** 0 除算を避ける除算。 */
export function safeDivide(a: number, b: number, fallback = 0): number {
  return b === 0 ? fallback : a / b;
}

/** 変化率(%)。from が 0 のとき NaN。 */
export function percentChange(from: number, to: number): number {
  return from === 0 ? NaN : ((to - from) / Math.abs(from)) * 100;
}

/** 最大公約数。 */
export function gcd(a: number, b: number): number {
  a = Math.abs(a); b = Math.abs(b);
  while (b) { [a, b] = [b, a % b]; }
  return a;
}

/** 最小公倍数。 */
export function lcm(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return Math.abs(a / gcd(a, b) * b);
}

/** 偶数か。 */
export function isEven(n: number): boolean { return n % 2 === 0; }
/** 奇数か。 */
export function isOdd(n: number): boolean { return Math.abs(n % 2) === 1; }

/** start から end 未満まで step 刻みの数列。 */
export function sequence(start: number, end: number, step = 1): number[] {
  if (step === 0) return [];
  const out: number[] = [];
  if (step > 0) for (let i = start; i < end; i += step) out.push(i);
  else for (let i = start; i > end; i += step) out.push(i);
  return out;
}

/** min〜max の整数乱数(両端含む)。暗号用途には使わないこと。 */
export function randomInt(min: number, max: number): number {
  const lo = Math.ceil(Math.min(min, max));
  const hi = Math.floor(Math.max(min, max));
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

// ───────────────────────── 統計 ─────────────────────────

/** 合計。 */
export function sum(values: readonly number[]): number {
  let s = 0;
  for (const v of values) s += v;
  return s;
}

/** 平均。空配列は NaN。 */
export function mean(values: readonly number[]): number {
  return values.length === 0 ? NaN : sum(values) / values.length;
}

/** 最小値。空配列は NaN。 */
export function min(values: readonly number[]): number {
  return values.length === 0 ? NaN : Math.min(...values);
}

/** 最大値。空配列は NaN。 */
export function max(values: readonly number[]): number {
  return values.length === 0 ? NaN : Math.max(...values);
}

/** 中央値。空配列は NaN。 */
export function median(values: readonly number[]): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2 : (sorted[mid] ?? 0);
}

/** 最頻値(複数あれば昇順で返す)。空配列は空配列。 */
export function mode(values: readonly number[]): number[] {
  if (values.length === 0) return [];
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  const maxCount = Math.max(...counts.values());
  return [...counts.entries()].filter(([, c]) => c === maxCount).map(([v]) => v).sort((a, b) => a - b);
}

/** 分散。sample=true で不偏分散(n-1)。空/単一要素は NaN(sample) / 0。 */
export function variance(values: readonly number[], options: { sample?: boolean } = {}): number {
  const n = values.length;
  if (n === 0) return NaN;
  const sample = options.sample ?? false;
  const denom = sample ? n - 1 : n;
  if (denom === 0) return NaN;
  const m = mean(values);
  let acc = 0;
  for (const v of values) acc += (v - m) ** 2;
  return acc / denom;
}

/** 標準偏差。 */
export function stddev(values: readonly number[], options: { sample?: boolean } = {}): number {
  return Math.sqrt(variance(values, options));
}

/** パーセンタイル(p: 0〜100・線形補間)。空配列は NaN。 */
export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = (clamp(p, 0, 100) / 100) * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sorted[lo] ?? NaN;
  const frac = rank - lo;
  return (sorted[lo] ?? 0) * (1 - frac) + (sorted[hi] ?? 0) * frac;
}

// ───────────────────────── 系列・分布 ─────────────────────────

/** 移動平均(全区間ぶんのみ・長さ = n - window + 1)。 */
export function movingAverage(values: readonly number[], window: number): number[] {
  if (window <= 0 || values.length < window) return [];
  const out: number[] = [];
  let windowSum = 0;
  for (let i = 0; i < values.length; i++) {
    windowSum += values[i]!;
    if (i >= window) windowSum -= values[i - window]!;
    if (i >= window - 1) out.push(windowSum / window);
  }
  return out;
}

/** 累積和(同じ長さ)。 */
export function cumulativeSum(values: readonly number[]): number[] {
  const out: number[] = [];
  let acc = 0;
  for (const v of values) { acc += v; out.push(acc); }
  return out;
}

/** 度数分布の 1 区間。 */
export interface HistogramBin { start: number; end: number; count: number }

/** {@link histogram} のオプション。 */
export interface HistogramOptions { bins?: number; min?: number; max?: number }

/** 度数分布を作る(既定ビン数 = ceil(√n))。区間は [start, end)、最終区間のみ end 含む。 */
export function histogram(values: readonly number[], options: HistogramOptions = {}): HistogramBin[] {
  if (values.length === 0) return [];
  const lo = options.min ?? Math.min(...values);
  const hi = options.max ?? Math.max(...values);
  const bins = Math.max(1, options.bins ?? Math.ceil(Math.sqrt(values.length)));
  if (hi === lo) return [{ start: lo, end: hi, count: values.filter((v) => v >= lo && v <= hi).length }];
  const width = (hi - lo) / bins;
  const result: HistogramBin[] = [];
  for (let i = 0; i < bins; i++) result.push({ start: lo + i * width, end: lo + (i + 1) * width, count: 0 });
  for (const v of values) {
    if (v < lo || v > hi) continue;
    let idx = Math.floor((v - lo) / width);
    if (idx >= bins) idx = bins - 1;
    if (idx < 0) idx = 0;
    result[idx]!.count++;
  }
  return result;
}

/** 四分位。 */
export interface Quartiles { min: number; q1: number; median: number; q3: number; max: number; iqr: number }

/** 四分位(Q1/中央値/Q3)と IQR。空配列は NaN。 */
export function quartiles(values: readonly number[]): Quartiles {
  if (values.length === 0) return { min: NaN, q1: NaN, median: NaN, q3: NaN, max: NaN, iqr: NaN };
  const q1 = percentile(values, 25);
  const q2 = percentile(values, 50);
  const q3 = percentile(values, 75);
  return { min: min(values), q1, median: q2, q3, max: max(values), iqr: q3 - q1 };
}

/** {@link formatRange} のオプション。 */
export interface FormatRangeOptions { separator?: string; decimals?: number; prefix?: string; suffix?: string }

/** 範囲を整形する(例: "1,000〜2,000")。 */
export function formatRange(a: number, b: number, options: FormatRangeOptions = {}): string {
  const { separator = "〜", decimals, prefix = "", suffix = "" } = options;
  const fmt = (n: number) => prefix + formatNumber(n, { decimals }) + suffix;
  return fmt(a) + separator + fmt(b);
}

// ───────────────────────── 外れ値 ─────────────────────────

/** 外れ値判定の境界(IQR 法)。 */
export interface OutlierBounds { lower: number; upper: number }

/** IQR 法の下限・上限(既定 k=1.5)。 */
export function outlierBounds(values: readonly number[], k = 1.5): OutlierBounds {
  const { q1, q3, iqr } = quartiles(values);
  return { lower: q1 - k * iqr, upper: q3 + k * iqr };
}

/** IQR 法で外れ値を抽出する。 */
export function outliers(values: readonly number[], k = 1.5): number[] {
  if (values.length === 0) return [];
  const { lower, upper } = outlierBounds(values, k);
  return values.filter((v) => v < lower || v > upper);
}

/** 外れ値を除いた値。 */
export function withoutOutliers(values: readonly number[], k = 1.5): number[] {
  if (values.length === 0) return [];
  const { lower, upper } = outlierBounds(values, k);
  return values.filter((v) => v >= lower && v <= upper);
}

// ───────────────────────── 回帰・トレンド ─────────────────────────

/** 単回帰の結果。 */
export interface LinearFit { slope: number; intercept: number; r2: number }

/** x, y の単回帰(最小二乗)。R² は相関係数の 2 乗。 */
export function linearRegressionXY(xs: readonly number[], ys: readonly number[]): LinearFit {
  const n = Math.min(xs.length, ys.length);
  if (n === 0) return { slope: NaN, intercept: NaN, r2: NaN };
  let sx = 0, sy = 0;
  for (let i = 0; i < n; i++) { sx += xs[i]!; sy += ys[i]!; }
  const mx = sx / n, my = sy / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i]! - mx, dy = ys[i]! - my;
    sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
  }
  const slope = sxx === 0 ? 0 : sxy / sxx;
  const intercept = my - slope * mx;
  const r2 = syy === 0 ? 1 : sxx === 0 ? 0 : (sxy * sxy) / (sxx * syy);
  return { slope, intercept, r2 };
}

/** 値配列(x=0,1,2,…)の単回帰。 */
export function linearRegression(ys: readonly number[]): LinearFit {
  return linearRegressionXY(ys.map((_, i) => i), ys);
}

/** 回帰直線で x の予測値を返す。 */
export function predict(fit: LinearFit, x: number): number {
  return fit.slope * x + fit.intercept;
}

/** トレンドの向き。 */
export type TrendDirection = "up" | "down" | "flat";

/** 単回帰の傾きからトレンドを判定する。 */
export function trend(values: readonly number[], threshold = 0): { slope: number; direction: TrendDirection } {
  const { slope } = linearRegression(values);
  const direction: TrendDirection = slope > threshold ? "up" : slope < -threshold ? "down" : "flat";
  return { slope, direction };
}

// ───────────────────────── 相関 ─────────────────────────

/** 共分散。sample=true で不偏(n-1)。 */
export function covariance(xs: readonly number[], ys: readonly number[], options: { sample?: boolean } = {}): number {
  const n = Math.min(xs.length, ys.length);
  if (n === 0) return NaN;
  const denom = options.sample ? n - 1 : n;
  if (denom === 0) return NaN;
  let sx = 0, sy = 0;
  for (let i = 0; i < n; i++) { sx += xs[i]!; sy += ys[i]!; }
  const mx = sx / n, my = sy / n;
  let acc = 0;
  for (let i = 0; i < n; i++) acc += (xs[i]! - mx) * (ys[i]! - my);
  return acc / denom;
}

/** ピアソンの相関係数(-1〜1)。分散 0 の場合は NaN。 */
export function correlation(xs: readonly number[], ys: readonly number[]): number {
  const n = Math.min(xs.length, ys.length);
  if (n === 0) return NaN;
  let sx = 0, sy = 0;
  for (let i = 0; i < n; i++) { sx += xs[i]!; sy += ys[i]!; }
  const mx = sx / n, my = sy / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i]! - mx, dy = ys[i]! - my;
    sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
  }
  return sxx === 0 || syy === 0 ? NaN : sxy / Math.sqrt(sxx * syy);
}

// ───────────────────────── 予測バンド ─────────────────────────

function zForLevel(level: number): number {
  if (level >= 0.99) return 2.576;
  if (level >= 0.98) return 2.326;
  if (level >= 0.95) return 1.96;
  if (level >= 0.9) return 1.645;
  if (level >= 0.8) return 1.282;
  return 1.0;
}

/** 回帰区間の 1 点。 */
export interface RegressionInterval { yhat: number; lower: number; upper: number; se: number }

/** {@link regressionInterval} のオプション。kind: 平均の信頼区間 or 新規観測の予測区間。 */
export interface RegressionBandOptions { level?: number; kind?: "confidence" | "prediction" }

/** x0 における回帰の区間(正規近似)。n<3 は点推定のみ。 */
export function regressionInterval(xs: readonly number[], ys: readonly number[], x0: number, options: RegressionBandOptions = {}): RegressionInterval {
  const n = Math.min(xs.length, ys.length);
  const fit = linearRegressionXY(xs, ys);
  const yhat = predict(fit, x0);
  if (n < 3) return { yhat, lower: yhat, upper: yhat, se: 0 };
  let sx = 0;
  for (let i = 0; i < n; i++) sx += xs[i]!;
  const mx = sx / n;
  let sxx = 0, ssRes = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i]! - mx;
    sxx += dx * dx;
    const resid = ys[i]! - predict(fit, xs[i]!);
    ssRes += resid * resid;
  }
  const seResid = Math.sqrt(ssRes / (n - 2));
  const level = options.level ?? 0.95;
  const kind = options.kind ?? "confidence";
  const base = 1 / n + (sxx === 0 ? 0 : ((x0 - mx) * (x0 - mx)) / sxx);
  const se = seResid * Math.sqrt((kind === "prediction" ? 1 : 0) + base);
  const margin = zForLevel(level) * se;
  return { yhat, lower: yhat - margin, upper: yhat + margin, se };
}

/** 各 x に対する回帰区間の配列(予測バンド用)。 */
export function regressionBand(xs: readonly number[], ys: readonly number[], options: RegressionBandOptions = {}): Array<{ x: number; yhat: number; lower: number; upper: number }> {
  return xs.map((x) => {
    const r = regressionInterval(xs, ys, x, options);
    return { x, yhat: r.yhat, lower: r.lower, upper: r.upper };
  });
}

// ───────────────────────── 季節性分解 ─────────────────────────

function centeredMovingAverage(values: readonly number[], period: number): Array<number | null> {
  const n = values.length;
  const out: Array<number | null> = new Array(n).fill(null);
  const half = Math.floor(period / 2);
  for (let i = 0; i < n; i++) {
    if (i - half < 0 || i + half >= n) continue;
    if (period % 2 === 1) {
      let s = 0;
      for (let j = i - half; j <= i + half; j++) s += values[j]!;
      out[i] = s / period;
    } else {
      let s = 0.5 * values[i - half]! + 0.5 * values[i + half]!;
      for (let j = i - half + 1; j < i + half; j++) s += values[j]!;
      out[i] = s / period;
    }
  }
  return out;
}

/** 季節性分解の結果(加法モデル)。 */
export interface Decomposition {
  trend: Array<number | null>;
  seasonal: number[];
  residual: Array<number | null>;
  seasonalIndices: number[];
}

/** 加法モデルで季節性分解する(trend=中心化移動平均、seasonal=位相平均)。 */
export function decompose(values: readonly number[], period: number): Decomposition {
  const n = values.length;
  if (period <= 1 || n < period * 2) {
    return { trend: new Array(n).fill(null), seasonal: new Array(n).fill(0), residual: new Array(n).fill(null), seasonalIndices: new Array(Math.max(0, period)).fill(0) };
  }
  const trend = centeredMovingAverage(values, period);
  // detrended = values - trend
  const detrendedByPhase: number[][] = Array.from({ length: period }, () => []);
  for (let i = 0; i < n; i++) {
    const t = trend[i];
    if (t == null) continue;
    detrendedByPhase[i % period]!.push(values[i]! - t);
  }
  const rawIndices = detrendedByPhase.map((arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0));
  // 季節指数を中心化(平均0)
  const meanIdx = rawIndices.reduce((a, b) => a + b, 0) / period;
  const seasonalIndices = rawIndices.map((v) => v - meanIdx);
  const seasonal = Array.from({ length: n }, (_, i) => seasonalIndices[i % period]!);
  const residual: Array<number | null> = values.map((v, i) => {
    const t = trend[i];
    return t == null ? null : v - t - seasonal[i]!;
  });
  return { trend, seasonal, residual, seasonalIndices };
}

// ───────────────────────── 行データ→系列 ─────────────────────────

/** 行(オブジェクト配列)から数値列を取り出す。文字列は parseNumber で解釈。 */
export function pluckNumbers(rows: ReadonlyArray<Record<string, unknown>>, key: string, options: { skipInvalid?: boolean } = {}): number[] {
  const skipInvalid = options.skipInvalid ?? true;
  const out: number[] = [];
  for (const row of rows) {
    const raw = row[key];
    const n = typeof raw === "number" ? raw : parseNumber(String(raw ?? ""));
    if (Number.isNaN(n)) { if (skipInvalid) continue; out.push(NaN); }
    else out.push(n);
  }
  return out;
}

/** 行から {x, y} 系列を取り出す(xKey 省略で連番)。 */
export function seriesFromRows(rows: ReadonlyArray<Record<string, unknown>>, yKey: string, xKey?: string): Array<{ x: number; y: number }> {
  return rows.map((row, i) => {
    const y = typeof row[yKey] === "number" ? (row[yKey] as number) : parseNumber(String(row[yKey] ?? ""));
    const x = xKey ? (typeof row[xKey] === "number" ? (row[xKey] as number) : parseNumber(String(row[xKey] ?? ""))) : i;
    return { x, y };
  }).filter((p) => !Number.isNaN(p.y) && !Number.isNaN(p.x));
}

// ───────────────────────── 自己相関 ─────────────────────────

/** ラグ k の自己相関係数(lag 0 は 1)。 */
export function autocorrelation(values: readonly number[], lag: number): number {
  const n = values.length;
  if (n === 0 || lag < 0 || lag >= n) return NaN;
  const m = mean(values);
  let den = 0;
  for (let i = 0; i < n; i++) den += (values[i]! - m) ** 2;
  if (den === 0) return NaN;
  let num = 0;
  for (let i = 0; i < n - lag; i++) num += (values[i]! - m) * (values[i + lag]! - m);
  return num / den;
}

/** ラグ 0〜maxLag の自己相関(ACF)。 */
export function acf(values: readonly number[], maxLag: number): number[] {
  const out: number[] = [];
  for (let k = 0; k <= maxLag; k++) out.push(autocorrelation(values, k));
  return out;
}

/** 自己相関が最大になるラグ(1〜maxLag)。周期推定に使える。 */
export function dominantLag(values: readonly number[], maxLag: number): number {
  let bestLag = 1;
  let best = -Infinity;
  for (let k = 1; k <= maxLag && k < values.length; k++) {
    const a = autocorrelation(values, k);
    if (Number.isFinite(a) && a > best) { best = a; bestLag = k; }
  }
  return bestLag;
}
