/**
 * `@platform/ocr` — 画像の文字認識(OCR)連携。
 *
 * エンジンを抽象化し、tesseract.js(ローカル)や クラウド OCR(HTTP API)を差し替え可能にする。
 * @packageDocumentation
 */
import { AppError, ErrorCode, ok, err, type Result } from "@platform/core";

/** 認識した単語(位置つき)。 */
export interface OcrWord {
  text: string;
  confidence?: number;
  bbox?: { x0: number; y0: number; x1: number; y1: number };
}

/** OCR 結果。 */
export interface OcrResult {
  /** 認識テキスト全体。 */
  text: string;
  /** 全体の信頼度(0〜100)。 */
  confidence?: number;
  /** 単語単位の結果。 */
  words?: OcrWord[];
}

/** OCR エンジンの抽象(Adapter)。 */
export interface OcrEngine {
  recognize(image: Uint8Array | Blob | string): Promise<Result<OcrResult>>;
}

/** tesseract.js の最小型。 */
export interface TesseractLike {
  recognize(image: unknown, lang?: string): Promise<{ data: { text: string; confidence?: number; words?: { text: string; confidence?: number; bbox?: { x0: number; y0: number; x1: number; y1: number } }[] } }>;
}

/**
 * tesseract.js を使う OCR(ローカル処理・外部送信なし)。
 * @param tesseract `import Tesseract from "tesseract.js"` の Tesseract
 * @example
 * ```ts
 * import Tesseract from "tesseract.js";
 * const ocr = createTesseractOcr(Tesseract, { lang: "jpn+eng" });
 * const res = await ocr.recognize(imageBytes);
 * if (res.ok) console.log(res.value.text);
 * ```
 * @returns OCR の実装。**ローカルで動く**ので外部に画像を送らない(機密文書に向く)。ただし精度はクラウドに劣る
 */
export function createTesseractOcr(tesseract: TesseractLike, options: { lang?: string } = {}): OcrEngine {
  const lang = options.lang ?? "jpn+eng";
  return {
    async recognize(image) {
      try {
        const { data } = await tesseract.recognize(image, lang);
        return ok({
          text: data.text,
          confidence: data.confidence,
          words: data.words?.map((w) => ({ text: w.text, confidence: w.confidence, bbox: w.bbox })),
        });
      } catch (e) {
        return err(new AppError(ErrorCode.EXTERNAL, "OCR に失敗しました", { cause: e }));
      }
    },
  };
}

/** {@link createHttpOcr} のオプション。 */
export interface HttpOcrOptions {
  endpoint: string;
  headers?: Record<string, string>;
  /** 画像フィールド名(既定 "image")。 */
  fieldName?: string;
  /** レスポンス JSON → OcrResult 変換(API 仕様に合わせる)。 */
  parse: (json: unknown) => OcrResult;
  fetch?: typeof fetch;
}

/**
 * クラウド OCR を呼ぶ汎用アダプタ(HTTP + FormData)。
 *
 * **OCR サービスは差し替わる**(精度・価格・対応言語で選び直す)。
 * ここを通すことで、アプリ側のコードは変えずに済む。
 *
 * @param options.endpoint API の URL
 * @param options.apiKey 認証キー
 * @param options.fieldName 画像を送るフィールド名(既定 `file`)
 * @param options.parseResponse 応答からテキストを取り出す関数
 * @returns OCR の実装
 */
export function createHttpOcr(options: HttpOcrOptions): OcrEngine {
  const doFetch = options.fetch ?? fetch;
  return {
    async recognize(image) {
      try {
        const form = new FormData();
        const blob = image instanceof Blob ? image : typeof image === "string" ? new Blob([image]) : new Blob([image as unknown as BlobPart]);
        form.append(options.fieldName ?? "image", blob);
        const res = await doFetch(options.endpoint, { method: "POST", headers: options.headers, body: form });
        if (!res.ok) return err(new AppError(ErrorCode.EXTERNAL, `OCR API エラー(${res.status})`));
        return ok(options.parse(await res.json()));
      } catch (e) {
        return err(new AppError(ErrorCode.EXTERNAL, "OCR API 呼び出しに失敗しました", { cause: e }));
      }
    },
  };
}

export { extractReceiptFields, extractReceiptFieldsWithConfidence, parseJapaneseDate, extractAmount, findRegistrationNumber, findPhone, normalizeOcrText, extractLineItems, extractInvoiceFields, extractTaxBreakdown, type ReceiptFields, type ReceiptFieldsWithConfidence, type FieldWithConfidence, type LineItem, type InvoiceFields, type TaxRateLine } from "./extraction.js";
export { recognizeReceiptsBatch } from "./batch.js";
export { extractReceiptsFromResults, type ReceiptImportItem } from "./extraction.js";
