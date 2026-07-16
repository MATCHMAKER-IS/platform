/**
 * ブラウザ(Canvas)の画像処理ユーティリティ。アップロード前のリサイズや、
 * トリミング・モザイク・フィルタ・反転・形式変換・背景白抜き・マスクなど対話編集向け。
 * サーバ側の大量処理は @platform/image(sharp)を使う。寸法計算は共通の fitDimensions。
 * @packageDocumentation
 */
import { fitDimensions, mimeForFormat, type FitOptions, type ImageFormat } from "@platform/image/geometry";

type Source = Blob | HTMLImageElement | HTMLCanvasElement | ImageBitmap;

/**
 * File/Blob/URL から画像を読み込む。
 *
 *
 * @param src 画像の URL または Blob
 * @returns 読み込んだ画像
 * @throws 読み込みに失敗した場合(**壊れたファイル・CORS**)
 *
 * @param src 画像の URL または Blob
 * @returns 読み込んだ画像
 * @throws 読み込みに失敗した場合(**壊れたファイル・CORS**)
 */
export async function loadImage(src: Blob | string): Promise<HTMLImageElement> {
  const url = typeof src === "string" ? src : URL.createObjectURL(src);
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("画像の読み込みに失敗しました"));
      img.src = url;
    });
    return img;
  } finally {
    if (typeof src !== "string") setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

async function toDrawable(source: Source): Promise<{ el: CanvasImageSource; w: number; h: number }> {
  if (source instanceof Blob) { const img = await loadImage(source); return { el: img, w: img.naturalWidth, h: img.naturalHeight }; }
  if (source instanceof HTMLImageElement) return { el: source, w: source.naturalWidth, h: source.naturalHeight };
  if (source instanceof HTMLCanvasElement) return { el: source, w: source.width, h: source.height };
  return { el: source, w: (source as ImageBitmap).width, h: (source as ImageBitmap).height };
}

function canvasToBlob(canvas: HTMLCanvasElement, format: ImageFormat = "png", quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Blob 生成に失敗しました"))), mimeForFormat(format), quality),
  );
}

function makeCanvas(w: number, h: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w));
  canvas.height = Math.max(1, Math.round(h));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas コンテキストを取得できません");
  return { canvas, ctx };
}

/**
 * アスペクト比を保って縮小(アップロード前の実用サイズ化)。
 *
 *
 * @param image 元の画像
 * @param options.width / height 目標のサイズ
 * @param options.fit 収め方(`cover` / `contain`)
 * @returns 変換後の Blob(**ブラウザ内で完結**。サーバに送らないので機密画像も扱える)
 *
 * @param image 元の画像
 * @param options 目標のサイズと収め方
 * @returns 変換後の Blob(**ブラウザ内で完結**。サーバに送らないので機密画像も扱える)
 */
export async function resizeImage(source: Source, opts: FitOptions & { format?: ImageFormat; quality?: number }): Promise<Blob> {
  const { el, w, h } = await toDrawable(source);
  const { width, height } = fitDimensions(w, h, opts);
  const { canvas, ctx } = makeCanvas(width, height);
  ctx.drawImage(el, 0, 0, width, height);
  return canvasToBlob(canvas, opts.format ?? "webp", opts.quality ?? 0.85);
}

/**
 * 矩形で切り抜く(トリミング)。
 *
 *
 * @param image 元の画像
 * @param rect 切り抜く矩形
 * @returns 変換後の Blob
 *
 * @param image 元の画像
 * @param rect 切り抜く矩形
 * @returns 変換後の Blob
 */
export async function cropImage(source: Source, rect: { left: number; top: number; width: number; height: number }, format: ImageFormat = "png", quality?: number): Promise<Blob> {
  const { el } = await toDrawable(source);
  const { canvas, ctx } = makeCanvas(rect.width, rect.height);
  ctx.drawImage(el, rect.left, rect.top, rect.width, rect.height, 0, 0, rect.width, rect.height);
  return canvasToBlob(canvas, format, quality);
}

/**
 * モザイク(ピクセル化)。rect 未指定なら全体。
 *
 *
 * @param image 元の画像
 * @param rect モザイクをかける範囲
 * @param blockSize ブロックの大きさ(**大きいほど粗い**)
 * @returns 変換後の Blob。**個人情報を隠す用途では、元画像を破棄すること**(モザイクは復元されないが、元が残っていれば意味がない)
 *
 * @param image 元の画像
 * @param rect モザイクをかける範囲
 * @param blockSize ブロックの大きさ(**大きいほど粗い**)
 * @returns 変換後の Blob。**個人情報を隠す用途では元画像を破棄すること**(モザイクは復元されないが、元が残っていれば意味がない)
 */
export async function pixelate(source: Source, blockSize = 12, rect?: { left: number; top: number; width: number; height: number }, format: ImageFormat = "png"): Promise<Blob> {
  const { el, w, h } = await toDrawable(source);
  const { canvas, ctx } = makeCanvas(w, h);
  ctx.drawImage(el, 0, 0, w, h);
  const r = rect ?? { left: 0, top: 0, width: w, height: h };
  const cols = Math.max(1, Math.round(r.width / blockSize));
  const rows = Math.max(1, Math.round(r.height / blockSize));
  const tmp = makeCanvas(cols, rows);
  tmp.ctx.imageSmoothingEnabled = false;
  tmp.ctx.drawImage(canvas, r.left, r.top, r.width, r.height, 0, 0, cols, rows); // 縮小
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tmp.canvas, 0, 0, cols, rows, r.left, r.top, r.width, r.height);  // 拡大で粗く
  return canvasToBlob(canvas, format);
}

/** 明度/コントラスト/彩度/グレースケール/色反転/セピア/色相回転などのフィルタ。 */
export interface ImageFilters {
  brightness?: number;   // 1=等倍
  contrast?: number;     // 1=等倍
  saturate?: number;     // 1=等倍
  grayscale?: number;    // 0〜1
  invert?: number;       // 0〜1(色反転)
  sepia?: number;        // 0〜1
  hueRotate?: number;    // 度
  blur?: number;         // px
}

/**
 * CSS フィルタを適用する。
 *
 *
 * @param image 元の画像
 * @param filters 明度・彩度・コントラストなど
 * @returns 変換後の Blob
 *
 * @param image 元の画像
 * @param filters 明度・彩度・コントラストなど
 * @returns 変換後の Blob
 */
export async function applyFilters(source: Source, filters: ImageFilters, format: ImageFormat = "png", quality?: number): Promise<Blob> {
  const { el, w, h } = await toDrawable(source);
  const { canvas, ctx } = makeCanvas(w, h);
  const f = [
    filters.brightness != null && `brightness(${filters.brightness})`,
    filters.contrast != null && `contrast(${filters.contrast})`,
    filters.saturate != null && `saturate(${filters.saturate})`,
    filters.grayscale != null && `grayscale(${filters.grayscale})`,
    filters.invert != null && `invert(${filters.invert})`,
    filters.sepia != null && `sepia(${filters.sepia})`,
    filters.hueRotate != null && `hue-rotate(${filters.hueRotate}deg)`,
    filters.blur != null && `blur(${filters.blur}px)`,
  ].filter(Boolean).join(" ");
  ctx.filter = f || "none";
  ctx.drawImage(el, 0, 0, w, h);
  return canvasToBlob(canvas, format, quality);
}

/**
 * 反転(左右/上下ミラー)。
 *
 *
 * @param image 元の画像
 * @param axis 反転する軸(`horizontal` / `vertical`)
 * @returns 変換後の Blob
 *
 * @param image 元の画像
 * @param axis 反転する軸
 * @returns 変換後の Blob
 */
export async function flipImage(source: Source, opts: { horizontal?: boolean; vertical?: boolean }, format: ImageFormat = "png", quality?: number): Promise<Blob> {
  const { el, w, h } = await toDrawable(source);
  const { canvas, ctx } = makeCanvas(w, h);
  ctx.translate(opts.horizontal ? w : 0, opts.vertical ? h : 0);
  ctx.scale(opts.horizontal ? -1 : 1, opts.vertical ? -1 : 1);
  ctx.drawImage(el, 0, 0, w, h);
  return canvasToBlob(canvas, format, quality);
}

/**
 * 形式変換(jpg/png/webp)。
 *
 *
 * @param image 元の画像
 * @param format 変換先(`webp` / `jpeg` / `png`)
 * @param quality 品質(0〜1)
 * @returns 変換後の Blob。**webp は容量が小さい**が、古いブラウザでは表示できない
 *
 * @param image 元の画像
 * @param format 変換先
 * @param quality 品質(0〜1)
 * @returns 変換後の Blob。**webp は容量が小さい**が、古いブラウザでは表示できない
 */
export async function convertFormat(source: Source, format: ImageFormat, quality?: number): Promise<Blob> {
  const { el, w, h } = await toDrawable(source);
  const { canvas, ctx } = makeCanvas(w, h);
  if (format === "jpeg") { ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, w, h); } // JPEGは透明非対応→白地
  ctx.drawImage(el, 0, 0, w, h);
  return canvasToBlob(canvas, format, quality);
}

/**
 * 指定色に近い背景を透明にする(背景白抜き)。単色/近単色の背景向け。
 *
 *
 * @param image 元の画像
 * @param color 透過にする色
 * @param tolerance 許容差(**0 だと厳密一致**。JPEG は圧縮でわずかに色がずれるので、少し許容する)
 * @returns 変換後の Blob
 *
 * @param image 元の画像
 * @param color 透過にする色
 * @param tolerance 許容差(**0 だと厳密一致**。JPEG は圧縮でわずかに色がずれるので少し許容する)
 * @returns 変換後の Blob
 */
export async function removeBackgroundColor(source: Source, options: { color?: { r: number; g: number; b: number }; tolerance?: number } = {}, format: ImageFormat = "png"): Promise<Blob> {
  const { color = { r: 255, g: 255, b: 255 }, tolerance = 24 } = options;
  const { el, w, h } = await toDrawable(source);
  const { canvas, ctx } = makeCanvas(w, h);
  ctx.drawImage(el, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;
  const t2 = tolerance * tolerance * 3;
  for (let i = 0; i < px.length; i += 4) {
    const dr = px[i]! - color.r, dg = px[i + 1]! - color.g, db = px[i + 2]! - color.b;
    if (dr * dr + dg * dg + db * db <= t2) px[i + 3] = 0; // 近い色は透明化
  }
  ctx.putImageData(data, 0, 0);
  return canvasToBlob(canvas, format);
}

/**
 * 円/角丸マスク。
 *
 *
 * @param image 元の画像
 * @param mask マスク画像
 * @returns 変換後の Blob
 *
 * @param image 元の画像
 * @param mask マスク画像
 * @returns 変換後の Blob
 */
export async function maskImage(source: Source, shape: "circle" | "rounded", radius = 24, format: ImageFormat = "png"): Promise<Blob> {
  const { el, w, h } = await toDrawable(source);
  const { canvas, ctx } = makeCanvas(w, h);
  ctx.beginPath();
  if (shape === "circle") {
    ctx.arc(w / 2, h / 2, Math.min(w, h) / 2, 0, Math.PI * 2);
  } else {
    const r = Math.min(radius, w / 2, h / 2);
    ctx.moveTo(r, 0); ctx.arcTo(w, 0, w, h, r); ctx.arcTo(w, h, 0, h, r); ctx.arcTo(0, h, 0, 0, r); ctx.arcTo(0, 0, w, 0, r);
  }
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(el, 0, 0, w, h);
  return canvasToBlob(canvas, format);
}

/**
 * Blob をダウンロードさせる。
 *
 * **一時的な `<a>` を作ってクリックし、すぐ消す**(ブラウザにダウンロードさせる定石)。
 * オブジェクト URL も解放する(しないとメモリリークになる)。
 *
 * @param blob ダウンロードさせるデータ
 * @param filename ファイル名
 * @returns なし
 */
export function downloadBlob(blob: Blob, filename: string): void {
  if (typeof document === "undefined") return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
