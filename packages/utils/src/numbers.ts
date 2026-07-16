/**
 * 数値ユーティリティ(純関数)。丸め・範囲・補間・整形・パース・統計など。
 * @packageDocumentation
 */

// ───────────────────────── 範囲・補間 ─────────────────────────

/**
 * min〜max に収める。
 *
 * @param n 対象の値
 * @param min 下限(これより小さければ min になる)
 * @param max 上限(これより大きければ max になる)
 * @returns 範囲内に収めた値
 */
export function clamp(n: number, min: number, max: number): number {
  return n < min ? min : n > max ? max : n;
}

/**
 * min〜max の範囲内かを判定する。
 *
 * @param n 判定する値
 * @param min 下限
 * @param max 上限
 * @returns 範囲内なら true。**両端を含む**
 */
export function inRange(n: number, min: number, max: number): boolean {
  return n >= min && n <= max;
}

/**
 * 線形補間する。
 *
 * @param a 始点の値(t=0 のときこれ)
 * @param b 終点の値(t=1 のときこれ)
 * @param t 位置(0〜1)。**範囲外も許す**(t=1.5 なら b を超える)
 * @returns 補間した値
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * 0〜1 に正規化する。
 *
 * @param n 対象の値
 * @param min 範囲の下限(この値なら 0)
 * @param max 範囲の上限(この値なら 1)
 * @returns 0〜1 の値。**min と max が同じなら 0**(0 除算を避ける)
 */
export function normalize(n: number, min: number, max: number): number {
  return max === min ? 0 : (n - min) / (max - min);
}

/**
 * ある範囲の値を別の範囲へ写像する。
 *
 * 例: 0〜100 のスコアを 0〜5 の星に変換する。
 *
 * @param n 対象の値
 * @param inMin 入力範囲の下限
 * @param inMax 入力範囲の上限
 * @param outMin 出力範囲の下限
 * @param outMax 出力範囲の上限
 * @returns 写像した値。**入力範囲外は出力範囲外になる**(clamp したいなら別途)
 *
 * @example
 * ```ts
 * mapRange(80, 0, 100, 0, 5);  // => 4(スコア 80 → 星 4)
 * ```
 */
export function mapRange(n: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
  return outMin + (outMax - outMin) * normalize(n, inMin, inMax);
}

// ───────────────────────── 丸め ─────────────────────────

/**
 * 指定小数桁で四捨五入する。
 *
 * `Math.round(n * 100) / 100` は浮動小数の誤差で `1.005` が `1` になるなど信用できない。
 * **指数表記を経由**して誤差を避けている。
 *
 * @param n 対象の値
 * @param decimals 小数桁(既定 0 = 整数に)
 * @returns 四捨五入した値。**Infinity / NaN はそのまま返す**
 *
 * @example
 * ```ts
 * round(1.005, 2);   // => 1.01(素朴な実装だと 1 になる)
 * round(1234.5);     // => 1235
 * ```
 */
export function round(n: number, decimals = 0): number {
  if (!Number.isFinite(n)) return n;
  const m = Number(`${n}e${decimals}`);
  return Number(`${Math.round(m)}e${-decimals}`);
}

/**
 * 指定小数桁で切り上げる。
 *
 * @param n 対象の値
 * @param decimals 小数桁(既定 0)
 * @returns 切り上げた値。**負の数は 0 に近づく**(-1.5 → -1)
 */
export function ceilTo(n: number, decimals = 0): number {
  const f = 10 ** decimals;
  return Math.ceil(n * f) / f;
}

/**
 * 指定小数桁で切り捨てる。
 *
 * **消費税の計算で最もよく使う**(日本の商習慣では切り捨てが一般的)。
 * ただし税額の計算は `@platform/tax` を使うこと(端数処理の方針が一元管理されている)。
 *
 * @param n 対象の値
 * @param decimals 小数桁(既定 0)
 * @returns 切り捨てた値。**負の数は 0 から遠ざかる**(-1.5 → -2)
 */
export function floorTo(n: number, decimals = 0): number {
  const f = 10 ** decimals;
  return Math.floor(n * f) / f;
}

/**
 * step の倍数へ丸める。
 *
 * 「価格を 100 円単位にする」「時間を 15 分刻みにする」といった用途。
 *
 * @param n 対象の値
 * @param step 刻み(例: 5 なら 5 の倍数へ)。**0 なら何もしない**(0 除算を避ける)
 * @returns 最も近い step の倍数
 *
 * @example
 * ```ts
 * roundToStep(1234, 100);  // => 1200
 * roundToStep(7, 5);       // => 5
 * ```
 */
export function roundToStep(n: number, step: number): number {
  if (step === 0) return n;
  return Math.round(n / step) * step;
}

/**
 * 銀行丸め(偶数丸め)。ちょうど 0.5 のとき、最も近い**偶数**へ丸める。
 *
 * **なぜ必要か**: 四捨五入を大量に繰り返すと、0.5 が常に切り上がるため**合計が実際より大きくなる**
 * (統計的な偏り)。会計・統計では偶数丸めで偏りを打ち消す。
 *
 * @param n 対象の値
 * @param decimals 小数桁(既定 0)
 * @returns 丸めた値
 *
 * @example
 * ```ts
 * roundHalfEven(0.5);   // => 0(四捨五入なら 1)
 * roundHalfEven(1.5);   // => 2
 * roundHalfEven(2.5);   // => 2(四捨五入なら 3)
 * ```
 */
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

/**
 * 小数を切り捨てる。**常に 0 の方向へ**(floorTo と負の数で挙動が違う)。
 *
 * @param n 対象の値
 * @param decimals 小数桁(既定 0)
 * @returns 切り捨てた値
 *
 * @example
 * ```ts
 * truncateDecimals(-1.5);  // => -1(0 に近づく)
 * floorTo(-1.5);           // => -2(0 から遠ざかる)
 * ```
 */
export function truncateDecimals(n: number, decimals = 0): number {
  const f = 10 ** decimals;
  return Math.trunc(n * f) / f;
}

// ───────────────────────── 整形 ─────────────────────────

/** {@link formatNumber} のオプション。 */
export interface FormatNumberOptions { decimals?: number; thousandsSep?: string; decimalSep?: string }

/**
 * 桁区切りで整形する。
 *
 * @param n 対象の値
 * @param options.decimals 小数桁(**指定すると固定**。省略なら元の桁のまま)
 * @param options.thousandsSep 桁区切り(既定 `,`)
 * @param options.decimalSep 小数点(既定 `.`)
 * @returns 整形した文字列。**Infinity / NaN はそのまま文字列化**
 *
 * @example
 * ```ts
 * formatNumber(1234567);              // => "1,234,567"
 * formatNumber(1234.5, { decimals: 2 });  // => "1,234.50"
 * ```
 */
export function formatNumber(n: number, options: FormatNumberOptions = {}): string {
  const { decimals, thousandsSep = ",", decimalSep = "." } = options;
  if (!Number.isFinite(n)) return String(n);
  const abs = Math.abs(n);
  const s = decimals != null ? round(abs, decimals).toFixed(decimals) : String(abs);
  const [intPart, fracPart] = s.split(".");
  const grouped = (intPart ?? "0").replace(/\B(?=(\d{3})+(?!\d))/g, thousandsSep);
  return (n < 0 ? "-" : "") + grouped + (fracPart ? decimalSep + fracPart : "");
}

/**
 * パーセント文字列にする。
 *
 * @param value 値。**既定は比率**(0.25 → "25%")
 * @param decimals 小数桁(既定 0)
 * @param options.ratio 入力が比率か(既定 true)。**すでに % の値なら false**(25 → "25%")
 * @returns `"25%"` 形式の文字列
 *
 * @example
 * ```ts
 * formatPercent(0.256, 1);              // => "25.6%"
 * formatPercent(25, 0, { ratio: false }); // => "25%"
 * ```
 */
export function formatPercent(value: number, decimals = 0, options: { ratio?: boolean } = {}): string {
  const ratio = options.ratio ?? true;
  const pct = ratio ? value * 100 : value;
  return `${round(pct, decimals).toFixed(decimals)}%`;
}

/**
 * 短縮表記にする(1.2K / 3.4M / 5.6B / 7.8T)。
 *
 * **英語圏の慣習**。日本語の画面では {@link formatManOku} を使うこと。
 *
 * @param n 対象の値
 * @param decimals 小数桁(既定 1)
 * @returns 短縮した文字列。1000 未満はそのまま
 */
export function formatCompact(n: number, decimals = 1): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  const units: Array<[number, string]> = [[1e12, "T"], [1e9, "B"], [1e6, "M"], [1e3, "K"]];
  for (const [threshold, suffix] of units) {
    if (abs >= threshold) return sign + trimZeros(round(abs / threshold, decimals)) + suffix;
  }
  return sign + trimZeros(round(abs, decimals));
}

/**
 * 日本語の万/億/兆表記にする。
 *
 * **日本の画面ではこちらを使う**(1.2K より 1.2万 の方が直感的)。
 *
 * @param n 対象の値
 * @param decimals 小数桁(既定 1)
 * @returns 「1.2万」形式。1 万未満はそのまま
 *
 * @example
 * ```ts
 * formatManOku(12345);      // => "1.2万"
 * formatManOku(150000000);  // => "1.5億"
 * ```
 */
export function formatManOku(n: number, decimals = 1): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  const units: Array<[number, string]> = [[1e12, "兆"], [1e8, "億"], [1e4, "万"]];
  for (const [threshold, suffix] of units) {
    if (abs >= threshold) return sign + trimZeros(round(abs / threshold, decimals)) + suffix;
  }
  return sign + trimZeros(round(abs, decimals));
}

/**
 * バイト数を人が読める形にする。
 *
 * **1024 基準**(KB = 1024 B)。ストレージメーカーの 1000 基準とは違うので、
 * 表示が公称容量と食い違うことがある。
 *
 * @param bytes バイト数
 * @param decimals 小数桁(既定 1)
 * @returns 「1.5 MB」形式。0 なら「0 B」
 */
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

/**
 * 文字列を数値にする。
 *
 * **人が手入力した値を受け取る前提**で、全角数字・カンマ・通貨記号(¥$€£)・% を除去する。
 * 「1,234円」「１２３」「50%」なども通る。
 *
 * @param input 入力文字列
 * @returns 数値。**解釈できなければ NaN**(呼び出し側で `Number.isNaN` を見ること)
 *
 * @example
 * ```ts
 * parseNumber("1,234");   // => 1234
 * parseNumber("１２３");   // => 123(全角)
 * parseNumber("¥5,000");  // => 5000
 * parseNumber("abc");     // => NaN
 * ```
 */
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

/**
 * {@link parseNumber} の、失敗時に既定値を返す版。
 *
 * NaN の判定を呼び出し側で書かなくて済む。
 *
 * @param input 入力文字列
 * @param fallback 解釈できなかったときの値
 * @returns 数値、または fallback
 */
export function parseNumberOr(input: string, fallback: number): number {
  const n = parseNumber(input);
  return Number.isNaN(n) ? fallback : n;
}

// ───────────────────────── 計算補助 ─────────────────────────

/**
 * 0 除算を避けて割る。
 *
 * JavaScript の `1/0` は `Infinity` で例外にならないため、**画面に「Infinity%」と出る事故**が起きる。
 * 割合を計算するときは必ずこれを通す。
 *
 * @param a 割られる数
 * @param b 割る数
 * @param fallback b が 0 のときの値(既定 0)
 * @returns 商。**b が 0 なら fallback**
 *
 * @example
 * ```ts
 * safeDivide(done, total);        // total が 0 でも Infinity にならない
 * safeDivide(1, 0, 1);            // => 1(「全部完了」扱いにしたいとき)
 * ```
 */
export function safeDivide(a: number, b: number, fallback = 0): number {
  return b === 0 ? fallback : a / b;
}

/**
 * 変化率(%)を求める。
 *
 * @param from 変化前の値
 * @param to 変化後の値
 * @returns 変化率(%)。増えていれば正、減っていれば負。
 *   **from が 0 なら NaN**(0 からの変化率は定義できない。「前月 0 件 → 今月 5 件」は
 *   「∞% 増」ではなく「計算できない」が正しい)
 *
 * @example
 * ```ts
 * percentChange(100, 120);  // => 20(20% 増)
 * percentChange(100, 80);   // => -20
 * percentChange(0, 5);      // => NaN(呼び出し側で「新規」などと表示する)
 * ```
 */
export function percentChange(from: number, to: number): number {
  return from === 0 ? NaN : ((to - from) / Math.abs(from)) * 100;
}

/**
 * 最大公約数を求める(ユークリッドの互除法)。
 *
 * @param a 整数
 * @param b 整数
 * @returns 最大公約数(**常に正**)
 */
export function gcd(a: number, b: number): number {
  a = Math.abs(a); b = Math.abs(b);
  while (b) { [a, b] = [b, a % b]; }
  return a;
}

/**
 * 最小公倍数を求める。
 *
 * @param a 整数
 * @param b 整数
 * @returns 最小公倍数。**どちらかが 0 なら 0**
 */
export function lcm(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return Math.abs(a / gcd(a, b) * b);
}

/**
 * 偶数かを判定する。
 *
 * @param n 対象の値
 * @returns 偶数なら true(**0 は偶数**)
 */
export function isEven(n: number): boolean { return n % 2 === 0; }
/**
 * 奇数かを判定する。
 *
 * @param n 対象の値
 * @returns 奇数なら true(**負の数も正しく判定する**)
 */
export function isOdd(n: number): boolean { return Math.abs(n % 2) === 1; }

/**
 * 数列を作る。
 *
 * @param start 開始(含む)
 * @param end 終了(**含まない**)
 * @param step 刻み(既定 1)
 * @returns 数値の配列
 *
 * @example
 * ```ts
 * sequence(1, 5);      // => [1, 2, 3, 4](5 は含まない)
 * sequence(0, 10, 2);  // => [0, 2, 4, 6, 8]
 * ```
 */
export function sequence(start: number, end: number, step = 1): number[] {
  if (step === 0) return [];
  const out: number[] = [];
  if (step > 0) for (let i = start; i < end; i += step) out.push(i);
  else for (let i = start; i > end; i += step) out.push(i);
  return out;
}

/**
 * min〜max の整数乱数を返す。
 *
 * **暗号用途には使わないこと**(`Math.random()` は予測可能)。
 * パスワード・トークン・OTP には `@platform/crypto` を使う。
 *
 * @param min 下限(含む)
 * @param max 上限(**含む**)
 * @returns 整数
 */
export function randomInt(min: number, max: number): number {
  const lo = Math.ceil(Math.min(min, max));
  const hi = Math.floor(Math.max(min, max));
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

// ───────────────────────── 統計 ─────────────────────────

/**
 * 合計を求める。
 *
 * @param values 対象の値
 * @returns 合計。**空配列なら 0**(mean などと違い NaN にしない。「何も無い」の合計は 0 が自然)
 */
export function sum(values: readonly number[]): number {
  let s = 0;
  for (const v of values) s += v;
  return s;
}

/**
 * 平均を求める。
 *
 * **外れ値に弱い**。「だいたいこのくらい」を知りたいなら {@link median} を使う。
 *
 * @param values 対象の値
 * @returns 平均。**空配列なら NaN**(0 ではない。「平均が 0」と「データが無い」は違う)
 */
export function mean(values: readonly number[]): number {
  return values.length === 0 ? NaN : sum(values) / values.length;
}

/**
 * 最小値を求める。
 *
 * @param values 対象の値
 * @returns 最小値。**空配列なら NaN**(`Math.min()` は Infinity を返すので、それを避けている)
 */
export function min(values: readonly number[]): number {
  return values.length === 0 ? NaN : Math.min(...values);
}

/**
 * 最大値を求める。
 *
 * @param values 対象の値
 * @returns 最大値。**空配列なら NaN**(`Math.max()` は -Infinity を返すので、それを避けている)
 */
export function max(values: readonly number[]): number {
  return values.length === 0 ? NaN : Math.max(...values);
}

/**
 * 中央値を求める。
 *
 * **外れ値に強い**。「ほとんどの人はこのくらい」を表すのは平均より中央値。
 * (年収の平均は一部の高額所得者に引っ張られるが、中央値は引っ張られない)
 *
 * @param values 対象の値(**並べ替えは不要**。内部で行う)
 * @returns 中央値。偶数個なら中央 2 つの平均。**空配列なら NaN**
 */
export function median(values: readonly number[]): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2 : (sorted[mid] ?? 0);
}

/**
 * 最頻値(最も多く出た値)を求める。
 *
 * @param values 対象の値
 * @returns 最頻値の配列。**同じ回数のものが複数あれば全部返す**(昇順)。空配列なら空配列
 *
 * @example
 * ```ts
 * mode([1, 2, 2, 3]);     // => [2]
 * mode([1, 1, 2, 2]);     // => [1, 2](どちらも 2 回)
 * ```
 */
export function mode(values: readonly number[]): number[] {
  if (values.length === 0) return [];
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  const maxCount = Math.max(...counts.values());
  return [...counts.entries()].filter(([, c]) => c === maxCount).map(([v]) => v).sort((a, b) => a - b);
}

/**
 * 分散を求める。
 *
 * **標本か母集団かで割る数が変わる**(n-1 か n か)。手元のデータが
 * 「全部」なら母集団(既定)、「一部を抜き出したもの」なら標本(`sample: true`)。
 * 判断に迷うなら、統計の目的を確認すること(数値が変わる)。
 *
 * @param values 対象の値
 * @param options.sample 標本分散にするか(既定 false = 母分散)
 * @returns 分散。**空配列なら NaN**。標本で要素が 1 つなら NaN(n-1 = 0 で割れない)
 */
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

/**
 * 標準偏差を求める({@link variance} の平方根)。
 *
 * 分散と違い**元の値と同じ単位**になるので、人が読むならこちら。
 *
 * @param values 対象の値
 * @param options.sample 標本標準偏差にするか(既定 false)
 * @returns 標準偏差。空配列なら NaN
 */
export function stddev(values: readonly number[], options: { sample?: boolean } = {}): number {
  return Math.sqrt(variance(values, options));
}

/**
 * パーセンタイルを求める(線形補間)。
 *
 * **性能測定では平均より p95 を見る**(平均は外れ値に引きずられて実態を隠す)。
 * 「95% のリクエストがこの時間以内」という意味。
 *
 * @param values 対象の値(**並べ替えは不要**。内部で行う)
 * @param p 0〜100(**範囲外は 0/100 に丸める**)
 * @returns その位置の値。**空配列なら NaN**
 *
 * @example
 * ```ts
 * percentile(latencies, 95);  // p95(性能の目標値と比べる)
 * percentile(values, 50);     // 中央値と同じ
 * ```
 */
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

/**
 * 移動平均を求める。ノイズをならして傾向を見るのに使う。
 *
 * @param values 対象の値(時系列)
 * @param window 区間の幅(例: 7 なら 7 日移動平均)
 * @returns 移動平均の配列。**長さは `n - window + 1`**(端は計算できないので短くなる)。
 *   window が values より大きければ空配列
 */
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

/**
 * 累積和を求める。「今日までの合計」の推移を見るのに使う。
 *
 * @param values 対象の値
 * @returns 累積和の配列(**元と同じ長さ**)
 *
 * @example
 * ```ts
 * cumulativeSum([1, 2, 3]);  // => [1, 3, 6]
 * ```
 */
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

/**
 * 度数分布(ヒストグラム)を作る。
 *
 * @param values 対象の値
 * @param binCount 区間の数(既定は `ceil(√n)`。データ数に応じた無難な値)
 * @returns 各区間の範囲と件数。**区間は `[start, end)`**(最終区間だけ end を含む。
 *   そうしないと最大値がどこにも入らない)
 */
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

/**
 * 四分位(Q1 / 中央値 / Q3)と IQR を求める。
 *
 * 箱ひげ図や外れ値の判定に使う。
 *
 * @param values 対象の値
 * @returns Q1・中央値・Q3・IQR(= Q3 - Q1)。**空配列なら全て NaN**
 */
export function quartiles(values: readonly number[]): Quartiles {
  if (values.length === 0) return { min: NaN, q1: NaN, median: NaN, q3: NaN, max: NaN, iqr: NaN };
  const q1 = percentile(values, 25);
  const q2 = percentile(values, 50);
  const q3 = percentile(values, 75);
  return { min: min(values), q1, median: q2, q3, max: max(values), iqr: q3 - q1 };
}

/** {@link formatRange} のオプション。 */
export interface FormatRangeOptions { separator?: string; decimals?: number; prefix?: string; suffix?: string }

/**
 * 範囲を整形する。
 *
 * @param min 下限
 * @param max 上限
 * @param options {@link formatNumber} のオプション
 * @returns `"1,000〜2,000"` 形式
 */
export function formatRange(a: number, b: number, options: FormatRangeOptions = {}): string {
  const { separator = "〜", decimals, prefix = "", suffix = "" } = options;
  const fmt = (n: number) => prefix + formatNumber(n, { decimals }) + suffix;
  return fmt(a) + separator + fmt(b);
}

// ───────────────────────── 外れ値 ─────────────────────────

/** 外れ値判定の境界(IQR 法)。 */
export interface OutlierBounds { lower: number; upper: number }

/**
 * 外れ値とみなす下限・上限を求める(IQR 法)。
 *
 * **平均±標準偏差より外れ値に強い**(外れ値自体が平均を引っ張るため)。
 *
 * @param values 対象の値
 * @param k 係数(既定 1.5 = 一般的な基準。3 にすると「極端な外れ値」だけ)
 * @returns `{ lower, upper }`。この範囲外が外れ値
 */
export function outlierBounds(values: readonly number[], k = 1.5): OutlierBounds {
  const { q1, q3, iqr } = quartiles(values);
  return { lower: q1 - k * iqr, upper: q3 + k * iqr };
}

/**
 * 外れ値を抽出する(IQR 法)。
 *
 * @param values 対象の値
 * @param k 係数(既定 1.5)
 * @returns 外れ値だけの配列(**元の順序を保つ**)
 */
export function outliers(values: readonly number[], k = 1.5): number[] {
  if (values.length === 0) return [];
  const { lower, upper } = outlierBounds(values, k);
  return values.filter((v) => v < lower || v > upper);
}

/**
 * 外れ値を除いた値を返す。
 *
 * **除くかどうかは慎重に**。外れ値が「異常」なのか「重要な少数」なのかは、
 * データを見る人にしか分からない(例: 高額取引を外れ値として消すと売上を見誤る)。
 *
 * @param values 対象の値
 * @param k 係数(既定 1.5)
 * @returns 外れ値を除いた新しい配列
 */
export function withoutOutliers(values: readonly number[], k = 1.5): number[] {
  if (values.length === 0) return [];
  const { lower, upper } = outlierBounds(values, k);
  return values.filter((v) => v >= lower && v <= upper);
}

// ───────────────────────── 回帰・トレンド ─────────────────────────

/** 単回帰の結果。 */
export interface LinearFit { slope: number; intercept: number; r2: number }

/**
 * x, y の単回帰(最小二乗法)。
 *
 * @param xs x の値
 * @param ys y の値(**xs と同じ長さ**であること)
 * @returns 傾き・切片・R²(決定係数)。**R² は「どれだけ説明できているか」**(1 に近いほど当てはまりが良い)
 */
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

/**
 * 値の並びから単回帰する(x は 0, 1, 2, … と自動採番)。
 *
 * 時系列(日次の売上など)の傾向を見るのに使う。
 *
 * @param values 対象の値(**時系列の順に並んでいること**)
 * @returns 傾き・切片・R²
 */
export function linearRegression(ys: readonly number[]): LinearFit {
  return linearRegressionXY(ys.map((_, i) => i), ys);
}

/**
 * 回帰直線から予測値を求める。
 *
 * **外挿は慎重に**(データの範囲外を予測すると外れやすい)。
 *
 * @param model {@link linearRegression} の結果
 * @param x 予測したい位置
 * @returns 予測値
 */
export function predict(fit: LinearFit, x: number): number {
  return fit.slope * x + fit.intercept;
}

/** トレンドの向き。 */
export type TrendDirection = "up" | "down" | "flat";

/**
 * 傾きからトレンド(上昇/横ばい/下降)を判定する。
 *
 * @param model {@link linearRegression} の結果
 * @param threshold 「横ばい」とみなす傾きの幅(既定 0)。**データの単位に合わせて決める**
 *   (売上なら 1000 円、率なら 0.01 など。0 のままだと僅かな傾きでも上昇/下降になる)
 * @returns `"up"` / `"flat"` / `"down"`
 */
export function trend(values: readonly number[], threshold = 0): { slope: number; direction: TrendDirection } {
  const { slope } = linearRegression(values);
  const direction: TrendDirection = slope > threshold ? "up" : slope < -threshold ? "down" : "flat";
  return { slope, direction };
}

// ───────────────────────── 相関 ─────────────────────────

/**
 * 共分散を求める。
 *
 * **単位に依存する**ので大きさの比較には使えない。「関係の強さ」を見るなら
 * {@link correlation}(-1〜1 に正規化される)を使う。
 *
 * @param xs x の値
 * @param ys y の値(xs と同じ長さ)
 * @param options.sample 標本共分散にするか(既定 false)
 * @returns 共分散。長さが違う/空なら NaN
 */
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

/**
 * ピアソンの相関係数を求める。
 *
 * **相関は因果ではない。** 「アイスの売上と水難事故に相関がある」からといって
 * アイスが事故を起こすわけではない(どちらも気温が原因)。
 *
 * @param xs x の値
 * @param ys y の値(xs と同じ長さ)
 * @returns -1〜1。1 に近いほど正の相関、-1 に近いほど負の相関、0 なら無相関。
 *   **どちらかの分散が 0 なら NaN**(変化しない値との相関は定義できない)
 */
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

/**
 * 回帰の予測区間を求める(正規近似)。
 *
 * 「予測値はこのくらい、ただし幅がある」を示す。**点だけ見せると確実に見える**ので、
 * 予測を人に見せるときは区間も添えたい。
 *
 * @param xs x の値
 * @param ys y の値
 * @param x0 予測したい位置
 * @param confidence 信頼水準(既定 0.95)
 * @returns 予測値と下限・上限。**データが 3 点未満なら点推定のみ**(区間を出せない)
 */
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

/**
 * 複数の x について予測区間をまとめて求める(グラフの予測バンド用)。
 *
 * @param xs x の値
 * @param ys y の値
 * @param targets 予測したい位置の配列
 * @param confidence 信頼水準(既定 0.95)
 * @returns 各位置の予測値と区間
 */
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

/**
 * 時系列を「傾向 + 季節性 + 残差」に分解する(加法モデル)。
 *
 * 「売上が下がった」のが**季節要因なのか、本当の悪化なのか**を切り分けるのに使う。
 *
 * @param values 対象の値(**時系列の順**)
 * @param period 周期(例: 月次データで年周期なら 12、日次で週周期なら 7)
 * @returns trend(中心化移動平均)・seasonal(位相平均)・residual(残差)
 */
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

/**
 * オブジェクトの配列から数値の列を取り出す。
 *
 * DB や CSV から来た行をそのまま統計関数に渡すための橋渡し。
 * **文字列は {@link parseNumber} で解釈**する(「1,234」も通る)。
 *
 * @param rows 行の配列
 * @param key 取り出すキー
 * @returns 数値の配列。**解釈できない値は除外**(NaN を混ぜない)
 */
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

/**
 * オブジェクトの配列から `{x, y}` の系列を取り出す(回帰・グラフ用)。
 *
 * @param rows 行の配列
 * @param yKey y にするキー
 * @param xKey x にするキー(**省略すると 0, 1, 2, … の連番**)
 * @returns `{ xs, ys }`。どちらかが解釈できない行は除外
 */
export function seriesFromRows(rows: ReadonlyArray<Record<string, unknown>>, yKey: string, xKey?: string): Array<{ x: number; y: number }> {
  return rows.map((row, i) => {
    const y = typeof row[yKey] === "number" ? (row[yKey] as number) : parseNumber(String(row[yKey] ?? ""));
    const x = xKey ? (typeof row[xKey] === "number" ? (row[xKey] as number) : parseNumber(String(row[xKey] ?? ""))) : i;
    return { x, y };
  }).filter((p) => !Number.isNaN(p.y) && !Number.isNaN(p.x));
}

// ───────────────────────── 自己相関 ─────────────────────────

/**
 * 自己相関係数を求める(自分自身を k 期ずらしたものとの相関)。
 *
 * @param values 対象の値(時系列)
 * @param lag ずらす期数。**0 なら必ず 1**(自分自身との相関)
 * @returns -1〜1。lag が長さ以上なら NaN
 */
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

/**
 * ラグ 0〜maxLag の自己相関(ACF)を求める。
 *
 * @param values 対象の値(時系列)
 * @param maxLag 最大のラグ
 * @returns 各ラグの自己相関(**先頭は必ず 1**)
 */
export function acf(values: readonly number[], maxLag: number): number[] {
  const out: number[] = [];
  for (let k = 0; k <= maxLag; k++) out.push(autocorrelation(values, k));
  return out;
}

/**
 * 自己相関が最大になるラグを求める(周期の推定)。
 *
 * 「このデータは何日周期か」を機械的に見つける。7 が出れば週次、
 * 12 が出れば年次(月データの場合)の周期がある。
 *
 * @param values 対象の値(時系列)
 * @param maxLag 探す範囲の上限
 * @returns ラグと、そのときの自己相関。**lag 0 は除く**(自分自身は常に 1 なので意味がない)
 */
export function dominantLag(values: readonly number[], maxLag: number): number {
  let bestLag = 1;
  let best = -Infinity;
  for (let k = 1; k <= maxLag && k < values.length; k++) {
    const a = autocorrelation(values, k);
    if (Number.isFinite(a) && a > best) { best = a; bestLag = k; }
  }
  return bestLag;
}
