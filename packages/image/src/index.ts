/**
 * `@platform/image` — サーバ側の画像処理(sharp ラッパー)。
 *
 * リサイズ・切り抜き・回転・反転・グレースケール・階調反転・色調整(明度/彩度/色相)・
 * ぼかし・トリミング(余白自動除去)・フォーマット変換などを、順序付きの操作リストで適用する。
 * sharp は遅延読み込み(または注入)。ブラウザ側の対話編集は @platform/ui の画像ユーティリティを使う。
 *
 * @packageDocumentation
 */
import { AppError, ErrorCode, tryCatch, type Result } from "@platform/core";
import type { FitMode, ImageFormat } from "./geometry.js";
import { buildWatermarkComposite, type WatermarkOptions } from "./watermark.js";
import { mapWithConcurrency } from "./batch.js";

export * from "./geometry.js";
export { mapWithConcurrency, runBatch } from "./batch.js";
export { createRemoveBgRemover, createBackgroundRemover, type BackgroundRemover, type RemoveBgOptions, type GenericRemoverOptions } from "./background-removal.js";
export { watermarkTextSvg, gravityToSharp, buildWatermarkComposite, type Gravity, type WatermarkOptions, type WatermarkTextOptions } from "./watermark.js";

/** sharp インスタンス(利用する範囲の最小型)。 */
export interface SharpInstance {
  resize(opts: { width?: number; height?: number; fit?: string; withoutEnlargement?: boolean }): SharpInstance;
  extract(region: { left: number; top: number; width: number; height: number }): SharpInstance;
  rotate(angle?: number): SharpInstance;
  flip(): SharpInstance;
  flop(): SharpInstance;
  grayscale(): SharpInstance;
  negate(opts?: { alpha?: boolean }): SharpInstance;
  tint(rgb: { r: number; g: number; b: number }): SharpInstance;
  modulate(opts: { brightness?: number; saturation?: number; hue?: number; lightness?: number }): SharpInstance;
  blur(sigma?: number): SharpInstance;
  gamma(gamma: number): SharpInstance;
  normalize(): SharpInstance;
  median(size?: number): SharpInstance;
  trim(opts?: unknown): SharpInstance;
  flatten(opts?: { background?: string }): SharpInstance;
  composite(items: { input: Buffer | Uint8Array; blend?: string; gravity?: string }[]): SharpInstance;
  jpeg(opts?: { quality?: number }): SharpInstance;
  png(opts?: { quality?: number }): SharpInstance;
  webp(opts?: { quality?: number }): SharpInstance;
  avif(opts?: { quality?: number }): SharpInstance;
  toBuffer(): Promise<Buffer>;
  metadata(): Promise<{ width?: number; height?: number; format?: string; size?: number }>;
}

/** sharp ファクトリ(`import sharp from "sharp"` の sharp)。 */
export type SharpFactory = (input: Buffer | Uint8Array | string) => SharpInstance;

/** 画像入力。 */
export type ImageInput = Buffer | Uint8Array | string;

/** 適用する操作(順に適用される)。 */
export type ImageOp =
  | { op: "resize"; width?: number; height?: number; fit?: FitMode; withoutEnlargement?: boolean }
  | { op: "extract"; left: number; top: number; width: number; height: number }
  | { op: "rotate"; angle: number }
  | { op: "flip" }   // 上下反転
  | { op: "flop" }   // 左右反転(ミラー)
  | { op: "grayscale" }
  | { op: "negate" } // 階調反転(色反転)
  | { op: "tint"; color: { r: number; g: number; b: number } }
  | { op: "modulate"; brightness?: number; saturation?: number; hue?: number; lightness?: number }
  | { op: "blur"; sigma?: number }
  | { op: "gamma"; value: number }
  | { op: "normalize" }
  | { op: "trim" }
  | { op: "flatten"; background?: string } // 透明を背景色で塗りつぶし(白背景化など)
  | { op: "composite"; input: Buffer | Uint8Array; gravity?: string; blend?: string }
  | { op: "format"; type: ImageFormat; quality?: number };

/** 画像処理サービス。 */
export interface ImageProcessor {
  /** 操作リストを適用して出力バッファを返す。 */
  process(input: ImageInput, ops: ImageOp[]): Promise<Result<Buffer>>;
  /** メタデータ(幅・高さ・形式)を取得する。 */
  metadata(input: ImageInput): Promise<Result<{ width?: number; height?: number; format?: string; size?: number }>>;
  /** アップロード写真を実用サイズに正規化(縮小+形式/品質変換)。 */
  normalizeUpload(input: ImageInput, opts?: NormalizeOptions): Promise<Result<Buffer>>;
  /** 透かし(テキスト/画像)を重ねる。 */
  addWatermark(input: ImageInput, watermark: WatermarkOptions): Promise<Result<Buffer>>;
  /** EXIF/GPS などメタデータを除去する(再エンコード。プライバシー対策)。 */
  stripMetadata(input: ImageInput, opts?: { format?: ImageFormat; quality?: number }): Promise<Result<Buffer>>;
  /** 複数画像に同じ操作を適用(並行数指定)。 */
  processBatch(inputs: ImageInput[], ops: ImageOp[], options?: { concurrency?: number }): Promise<Result<Buffer>[]>;
}

/** {@link ImageProcessor.normalizeUpload} のオプション。 */
export interface NormalizeOptions {
  maxWidth?: number;
  maxHeight?: number;
  format?: ImageFormat;
  quality?: number;
}

function applyOp(img: SharpInstance, op: ImageOp): SharpInstance {
  switch (op.op) {
    case "resize": return img.resize({ width: op.width, height: op.height, fit: op.fit, withoutEnlargement: op.withoutEnlargement ?? true });
    case "extract": return img.extract({ left: op.left, top: op.top, width: op.width, height: op.height });
    case "rotate": return img.rotate(op.angle);
    case "flip": return img.flip();
    case "flop": return img.flop();
    case "grayscale": return img.grayscale();
    case "negate": return img.negate({ alpha: false });
    case "tint": return img.tint(op.color);
    case "modulate": return img.modulate({ brightness: op.brightness, saturation: op.saturation, hue: op.hue, lightness: op.lightness });
    case "blur": return img.blur(op.sigma);
    case "gamma": return img.gamma(op.value);
    case "normalize": return img.normalize();
    case "trim": return img.trim();
    case "composite": return img.composite([{ input: op.input, gravity: op.gravity, blend: op.blend }]);
    case "flatten": return img.flatten({ background: op.background ?? "#ffffff" });
    case "format":
      return op.type === "jpeg" ? img.jpeg({ quality: op.quality })
        : op.type === "png" ? img.png({ quality: op.quality })
        : op.type === "webp" ? img.webp({ quality: op.quality })
        : img.avif({ quality: op.quality });
  }
}

/**
 * 画像プロセッサを作る。sharp を注入するか、未指定なら遅延読み込みする。
 * @example
 * ```ts
 * import sharp from "sharp";
 * const image = createImageProcessor(sharp);
 * const res = await image.normalizeUpload(buf, { maxWidth: 1600, format: "webp", quality: 82 });
 * if (res.ok) await storage.put("photos/1.webp", res.value);
 * ```
 *
 * @param sharpFactory sharp のインスタンス(**依存を注入する**ので、テストでモックできる)
 * @returns 画像処理。**すべてのメソッドは Result 型を返す**(壊れた画像で例外を投げない)
 */
export function createImageProcessor(sharp?: SharpFactory): ImageProcessor {
  async function getSharp(): Promise<SharpFactory> {
    if (sharp) return sharp;
    const mod = (await import("sharp")) as unknown as { default: SharpFactory };
    return mod.default;
  }

  return {
    async process(input, ops) {
      return tryCatch(async () => {
        const s = await getSharp();
        let img = s(input);
        for (const op of ops) img = applyOp(img, op);
        return img.toBuffer();
      }).then((r) => (r.ok ? r : { ok: false as const, error: new AppError(ErrorCode.INTERNAL, "画像処理に失敗しました", { cause: r.error.cause ?? r.error }) }));
    },
    async metadata(input) {
      return tryCatch(async () => {
        const s = await getSharp();
        return s(input).metadata();
      }).then((r) => (r.ok ? r : { ok: false as const, error: new AppError(ErrorCode.INTERNAL, "画像メタデータの取得に失敗しました", { cause: r.error.cause ?? r.error }) }));
    },
    async normalizeUpload(input, opts = {}) {
      const { maxWidth = 2000, maxHeight = 2000, format = "webp", quality = 82 } = opts;
      return this.process(input, [
        { op: "rotate", angle: 0 }, // EXIF 向き補正(sharp は rotate() で自動補正)
        { op: "resize", width: maxWidth, height: maxHeight, fit: "contain", withoutEnlargement: true },
        { op: "format", type: format, quality },
      ]);
    },
    async addWatermark(input, watermark) {
      const { input: overlay, gravity } = buildWatermarkComposite(watermark);
      return this.process(input, [{ op: "composite", input: overlay, gravity }]);
    },
    async stripMetadata(input, opts = {}) {
      // sharp は withMetadata() を呼ばなければメタデータを出力しない = 再エンコードで EXIF/GPS が落ちる。
      // rotate() で EXIF 向きを反映してから破棄する。
      const ops: ImageOp[] = [{ op: "rotate", angle: 0 }];
      if (opts.format) ops.push({ op: "format", type: opts.format, quality: opts.quality });
      return this.process(input, ops);
    },
    async processBatch(inputs, ops, options = {}) {
      return mapWithConcurrency(inputs, (input) => this.process(input, ops), options.concurrency ?? 4);
    },
  };
}
