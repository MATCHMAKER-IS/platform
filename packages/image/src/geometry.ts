/**
 * 画像処理の純粋な計算(寸法・矩形・MIME)。sharp / Canvas 双方から使える。
 * @packageDocumentation
 */

/** リサイズの合わせ方。 */
export type FitMode = "contain" | "cover" | "fill";

/** リサイズ指定。 */
export interface FitOptions {
  maxWidth?: number;
  maxHeight?: number;
  /** contain=収まる / cover=覆う / fill=引き伸ばし(既定 contain)。 */
  fit?: FitMode;
  /** 元より拡大しない(既定 true)。 */
  withoutEnlargement?: boolean;
}

/**
 * アスペクト比を保ったまま、最大幅/高さに収まる出力寸法を計算する。
 * 「写真をアップロード時に実用サイズへ縮小」する用途の中心。
 * @param source 元のサイズ
 * @param target 目標のサイズ
 */
export function fitDimensions(srcW: number, srcH: number, opts: FitOptions = {}): { width: number; height: number } {
  const { maxWidth = Infinity, maxHeight = Infinity, fit = "contain", withoutEnlargement = true } = opts;
  if (srcW <= 0 || srcH <= 0) return { width: 1, height: 1 };

  if (fit === "fill") {
    let w = Number.isFinite(maxWidth) ? maxWidth : srcW;
    let h = Number.isFinite(maxHeight) ? maxHeight : srcH;
    if (withoutEnlargement) { w = Math.min(w, Math.max(srcW, maxWidth === Infinity ? srcW : w)); }
    return { width: Math.max(1, Math.round(w)), height: Math.max(1, Math.round(h)) };
  }

  const sw = maxWidth / srcW;
  const sh = maxHeight / srcH;
  let scale = fit === "cover" ? Math.max(sw, sh) : Math.min(sw, sh);
  if (!Number.isFinite(scale)) scale = 1;
  if (withoutEnlargement) scale = Math.min(scale, 1);
  return { width: Math.max(1, Math.round(srcW * scale)), height: Math.max(1, Math.round(srcH * scale)) };
}

/**
 * 切り抜き矩形を画像の範囲内に収める。
 *
 * **範囲外を指定すると sharp が例外を投げる**。利用者が画面でドラッグした値は
 * 端をはみ出すことがあるので、処理の前に通す。
 *
 * @param rect 切り抜き矩形
 * @param image 画像の幅・高さ
 * @returns 範囲内に収めた矩形
 */
export function clampRect(
  rect: { left: number; top: number; width: number; height: number },
  imgW: number,
  imgH: number,
): { left: number; top: number; width: number; height: number } {
  const left = Math.max(0, Math.min(Math.round(rect.left), imgW - 1));
  const top = Math.max(0, Math.min(Math.round(rect.top), imgH - 1));
  const width = Math.max(1, Math.min(Math.round(rect.width), imgW - left));
  const height = Math.max(1, Math.min(Math.round(rect.height), imgH - top));
  return { left, top, width, height };
}

/** 画像フォーマット。 */
export type ImageFormat = "jpeg" | "png" | "webp" | "avif";

/**
 * 画像フォーマットから MIME タイプを返す。
 *
 * @param format フォーマット(`jpeg` / `png` / `webp` など)
 * @returns MIME タイプ
 */
export function mimeForFormat(format: ImageFormat): string {
  return { jpeg: "image/jpeg", png: "image/png", webp: "image/webp", avif: "image/avif" }[format];
}

/**
 * 拡張子から画像フォーマットを判定する。
 *
 * **これは推定**(拡張子は偽装できる)。検証には `@platform/fs` の `detectFileType` を使う。
 *
 * @param ext 拡張子(`.jpg` など)
 * @returns フォーマット。**不明なら null**
 */
export function formatFromExtension(nameOrExt: string): ImageFormat | null {
  const ext = nameOrExt.toLowerCase().replace(/^.*\./, "");
  if (ext === "jpg" || ext === "jpeg") return "jpeg";
  if (ext === "png") return "png";
  if (ext === "webp") return "webp";
  if (ext === "avif") return "avif";
  return null;
}
