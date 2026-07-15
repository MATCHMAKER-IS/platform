/**
 * 色ユーティリティ(純)。hex⇔rgb⇔hsl 変換・WCAG コントラスト比・明暗調整・混色。
 * テーマ生成やアクセシビリティ検証に。
 * @packageDocumentation
 */

/** RGB(各 0〜255)。 */
export interface Rgb { r: number; g: number; b: number }
/** HSL(h:0〜360, s/l:0〜100)。 */
export interface Hsl { h: number; s: number; l: number }

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const round = (n: number) => Math.round(n);

/** hex("#rgb"/"#rrggbb"、# 省略可)を RGB に。不正なら null。 */
export function hexToRgb(hex: string): Rgb | null {
  let h = hex.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(h)) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}

/** RGB を "#rrggbb" に。 */
export function rgbToHex(rgb: Rgb): string {
  const to2 = (n: number) => clamp(round(n), 0, 255).toString(16).padStart(2, "0");
  return `#${to2(rgb.r)}${to2(rgb.g)}${to2(rgb.b)}`;
}

/** RGB → HSL。 */
export function rgbToHsl(rgb: Rgb): Hsl {
  const r = rgb.r / 255, g = rgb.g / 255, b = rgb.b / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return { h: round(h), s: round(s * 100), l: round(l * 100) };
}

/** HSL → RGB。 */
export function hslToRgb(hsl: Hsl): Rgb {
  const h = ((hsl.h % 360) + 360) % 360, s = clamp(hsl.s, 0, 100) / 100, l = clamp(hsl.l, 0, 100) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let rp = 0, gp = 0, bp = 0;
  if (h < 60) [rp, gp, bp] = [c, x, 0];
  else if (h < 120) [rp, gp, bp] = [x, c, 0];
  else if (h < 180) [rp, gp, bp] = [0, c, x];
  else if (h < 240) [rp, gp, bp] = [0, x, c];
  else if (h < 300) [rp, gp, bp] = [x, 0, c];
  else [rp, gp, bp] = [c, 0, x];
  return { r: round((rp + m) * 255), g: round((gp + m) * 255), b: round((bp + m) * 255) };
}

/** 相対輝度(WCAG)。0(黒)〜1(白)。 */
export function relativeLuminance(rgb: Rgb): number {
  const lin = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
  return 0.2126 * lin(rgb.r) + 0.7152 * lin(rgb.g) + 0.0722 * lin(rgb.b);
}

/** 2 色の WCAG コントラスト比(1〜21)。入力は hex か RGB。 */
export function contrastRatio(a: string | Rgb, b: string | Rgb): number {
  const ra = typeof a === "string" ? hexToRgb(a) : a;
  const rb = typeof b === "string" ? hexToRgb(b) : b;
  if (!ra || !rb) return 1;
  const la = relativeLuminance(ra), lb = relativeLuminance(rb);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
}

/** WCAG 合否("AA"/"AAA"・通常/大文字)。 */
export function wcagLevel(ratio: number, large = false): "AAA" | "AA" | "fail" {
  if (large) return ratio >= 4.5 ? "AAA" : ratio >= 3 ? "AA" : "fail";
  return ratio >= 7 ? "AAA" : ratio >= 4.5 ? "AA" : "fail";
}

/** 明るくする(amount:0〜1)。hex 入出力。 */
export function lighten(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const hsl = rgbToHsl(rgb);
  return rgbToHex(hslToRgb({ ...hsl, l: clamp(hsl.l + amount * 100, 0, 100) }));
}

/** 暗くする(amount:0〜1)。 */
export function darken(hex: string, amount: number): string {
  return lighten(hex, -amount);
}

/** 2 色を weight(0〜1・b 側の比率)で混ぜる。 */
export function mix(a: string, b: string, weight = 0.5): string {
  const ra = hexToRgb(a), rb = hexToRgb(b);
  if (!ra || !rb) return a;
  const w = clamp(weight, 0, 1);
  return rgbToHex({ r: ra.r + (rb.r - ra.r) * w, g: ra.g + (rb.g - ra.g) * w, b: ra.b + (rb.b - ra.b) * w });
}

/** 背景に対して読みやすい前景色(黒 or 白)を返す。 */
export function readableTextColor(background: string | Rgb): "#000000" | "#ffffff" {
  return contrastRatio(background, "#000000") >= contrastRatio(background, "#ffffff") ? "#000000" : "#ffffff";
}
