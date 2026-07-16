/**
 * 複数画像の一括 OCR 取り込み。並行数を絞り、各画像を認識 → 帳票フィールド抽出する。
 * 進捗コールバックで通知(@platform/notify と組み合わせられる)。
 * @packageDocumentation
 */
import type { OcrEngine } from "./index.js";
import { extractReceiptFields, type ReceiptImportItem } from "./extraction.js";

/**
 * 複数の領収書画像を一括で取り込む(認識 + フィールド抽出)。
 *
 * **1 枚失敗しても全体を止めない**(結果に成否を含めて返す)。
 * 100 枚のうち 1 枚が読めないだけで全部やり直しでは使えない。
 *
 * @param images 画像の配列
 * @param recognize OCR の実装(外部サービス)
 * @returns 各画像の抽出結果と成否
 */
export async function recognizeReceiptsBatch(
  engine: OcrEngine,
  images: (Uint8Array | Blob | string)[],
  options: { concurrency?: number; onProgress?: (p: { done: number; total: number; percent: number }) => void } = {},
): Promise<ReceiptImportItem[]> {
  const { concurrency = 3, onProgress } = options;
  const results = new Array<ReceiptImportItem>(images.length);
  const total = images.length;
  let next = 0;
  let done = 0;

  async function worker(): Promise<void> {
    while (next < total) {
      const i = next++;
      const res = await engine.recognize(images[i]!);
      results[i] = res.ok
        ? { index: i, ok: true, text: res.value.text, fields: extractReceiptFields(res.value.text) }
        : { index: i, ok: false, error: res.error.message };
      done++;
      onProgress?.({ done, total, percent: total === 0 ? 100 : Math.round((done / total) * 100) });
    }
  }
  const n = Math.max(1, Math.min(concurrency, total || 1));
  await Promise.all(Array.from({ length: n }, () => worker()));
  return results;
}
