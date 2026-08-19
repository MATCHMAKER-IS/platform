/**
 * 透かし合成の高レベルヘルパー。テキスト or 画像の透かしを sharp の composite で重ねる。
 * SVG 生成・配置(gravity)計算は純関数で、単体検証しやすい。
 * @packageDocumentation
 */

/** 配置位置。 */
export type Gravity = "center" | "north" | "south" | "east" | "west" | "northeast" | "northwest" | "southeast" | "southwest";

/**
 * 位置指定を sharp の gravity 文字列に変換する。
 *
 * @param g 位置(`top-left` など)
 * @returns sharp の gravity
 */
export function gravityToSharp(g: Gravity): string {
  return g === "center" ? "centre" : g;
}

/** {@link watermarkTextSvg} のオプション。 */
export interface WatermarkTextOptions {
  fontSize?: number;
  color?: string;
  opacity?: number;
  /** 影を付ける(視認性向上)。 */
  shadow?: boolean;
  /** フォント。 */
  fontFamily?: string;
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

/**
 * テキスト透かしの SVG を生成する。
 *
 * **SVG にするのは、フォントの用意なしに文字を描ける**ため
 * (sharp のテキスト描画は環境依存のフォントが要る)。
 *
 * **既定のフォントは `sans-serif`。** サーバ(Linux コンテナ)で
 * この SVG を画像化すると、日本語は **□(豆腐)** になる。
 * 日本語を透かすなら `fontFamily: "Noto Sans CJK JP"` を渡し、
 * コンテナに `fonts-noto-cjk` を入れておくこと
 * (`apps/internal-app/Dockerfile` が例)。
 *
 * @param text 透かす文字列(**options ではなく第 1 引数**)
 * @param options `fontSize`(既定 32)・`color`・`opacity`・`shadow`・`fontFamily` で見た目を決める
 * @returns SVG 文字列
 */
export function watermarkTextSvg(text: string, options: WatermarkTextOptions = {}): string {
  const { fontSize = 32, color = "#ffffff", opacity = 0.6, shadow = true, fontFamily = "sans-serif" } = options;
  const pad = Math.round(fontSize * 0.4);
  // **全角は半角の 2 倍の幅で数える。** `text.length` × 0.62 だと
  // 日本語で 40% 以上はみ出す(「社外秘」が枠から出る)。
  // 東アジアの文字・全角記号を 1.0em、それ以外を 0.55em として見積もる。
  const em = [...text].reduce(
    (a, ch) => a + (/[\u1100-\u115F\u2E80-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE30-\uFE6F\uFF00-\uFF60\uFFE0-\uFFE6]/.test(ch) ? 1.0 : 0.55),
    0,
  );
  const w = Math.max(1, em) * fontSize + pad * 2;
  const h = fontSize + pad * 2;
  // **属性に入る値はすべて esc を通す。** 本文(text)だけ通していたが、
  // fontFamily / color も属性なので、`" onload="…` の形で SVG に任意の属性を差し込める。
  // 生成した SVG は sharp に渡るだけでなく、画面へそのまま出す使い方もありうる。
  const font = esc(fontFamily);
  const fill = esc(color);
  const shadowEl = shadow
    ? `<text x="${pad + 1}" y="${fontSize + pad - 2}" font-family="${font}" font-size="${fontSize}" fill="#000000" fill-opacity="${opacity * 0.5}">${esc(text)}</text>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(w)}" height="${Math.round(h)}">${shadowEl}<text x="${pad}" y="${fontSize + pad - 3}" font-family="${font}" font-size="${fontSize}" fill="${fill}" fill-opacity="${opacity}">${esc(text)}</text></svg>`;
}

/** {@link WatermarkOptions}。text か image のどちらかを指定。 */
export interface WatermarkOptions {
  /** テキスト透かし。 */
  text?: string;
  /** テキスト透かしの見た目。 */
  textOptions?: WatermarkTextOptions;
  /** 画像透かし(ロゴ等の PNG バイト列)。 */
  image?: Uint8Array;
  /** 配置(既定 southeast=右下)。 */
  gravity?: Gravity;
}

/**
 * 透かし用の composite 項目を組み立てる(sharp に渡す形)。
 *
 * @param options 透かしの内容と位置
 * @returns sharp の `composite` に渡す配列
 */
export function buildWatermarkComposite(options: WatermarkOptions): { input: Uint8Array; gravity: string } {
  const gravity = gravityToSharp(options.gravity ?? "southeast");
  if (options.image) return { input: options.image, gravity };
  const svg = watermarkTextSvg(options.text ?? "", options.textOptions);
  return { input: new TextEncoder().encode(svg), gravity };
}
