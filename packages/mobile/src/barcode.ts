/**
 * バーコード。JAN/EAN のチェックディジット検証(純ロジック)と、
 * BarcodeDetector API による読み取りラッパー(対応環境のみ・feature detection つき)。
 * 棚卸し・入出荷・商品スキャンなどに使う。
 * @packageDocumentation
 */

/** 数字のみか。 */
function isDigits(s: string): boolean {
  return /^\d+$/.test(s);
}

/**
 * EAN/JAN のチェックディジットを計算する(データ桁から。右から重み 3,1,3,1…)。
 * @param dataDigits チェックディジットを除いたデータ桁(EAN-13 なら 12 桁、EAN-8 なら 7 桁)。
 * @returns チェックディジット(**最後の 1 桁**。これが合わないバーコードは誤読)
 */
export function eanCheckDigit(dataDigits: string): number {
  let sum = 0;
  // 右端を重み 3 として交互に
  for (let i = 0; i < dataDigits.length; i++) {
    const digit = dataDigits.charCodeAt(dataDigits.length - 1 - i) - 48;
    sum += digit * (i % 2 === 0 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10;
}

/**
 * EAN-13 / JAN として妥当かを判定する。
 *
 * **チェックディジットまで検証する**(桁数だけ見ると、読み取りミスを通してしまう)。
 * バーコードは汚れや角度で誤読するので、必ず検証すること。
 *
 * @param code 13 桁のコード
 * @returns 妥当なら true
 */
export function isValidEan13(code: string): boolean {
  const c = code.trim();
  if (!isDigits(c) || c.length !== 13) return false;
  return eanCheckDigit(c.slice(0, 12)) === c.charCodeAt(12) - 48;
}

/**
 * JAN コードとして妥当かを判定する。
 *
 * **日本の JAN は EAN-13 と同じ**。8 桁の短縮 JAN も許容する。
 *
 * @param code コード
 * @returns 妥当なら true
 */
export function isValidJan(code: string): boolean {
  return isValidEan13(code) || isValidEan8(code);
}

/**
 * EAN-8 として妥当かを判定する。
 *
 * @param code 8 桁のコード
 * @returns 妥当なら true
 */
export function isValidEan8(code: string): boolean {
  const c = code.trim();
  if (!isDigits(c) || c.length !== 8) return false;
  return eanCheckDigit(c.slice(0, 7)) === c.charCodeAt(7) - 48;
}

/** バーコード種別の推定。 */
export type BarcodeKind = "ean13" | "ean8" | "unknown";

/**
 * バーコードの種別を推定する。
 *
 * @param code コード
 * @returns 種別(`ean13` / `ean8` / `unknown`)
 */
export function detectBarcodeKind(code: string): BarcodeKind {
  if (isValidEan13(code)) return "ean13";
  if (isValidEan8(code)) return "ean8";
  return "unknown";
}

/**
 * JAN の国コードを返す(先頭 2〜3 桁)。
 *
 * **45 / 49 は日本**。
 *
 * @param code JAN コード
 * @returns 国コード
 */
export function janCountryPrefix(code: string): string | null {
  const c = code.trim();
  if (!isDigits(c) || c.length !== 13) return null;
  return c.slice(0, 2);
}

/**
 * 日本の事業者の JAN かを判定する。
 *
 * **45 または 49 始まり**。ただし**製造国とは限らない**(日本の企業が
 * 海外で作った商品も 45/49 になる)。
 *
 * @param code JAN コード
 * @returns 日本の事業者なら true
 */
export function isJapaneseJan(code: string): boolean {
  const p = janCountryPrefix(code);
  return p === "45" || p === "49";
}

// ─────────────────────── BarcodeDetector 読み取り(対応環境のみ) ───────────────────────

/** 読み取り結果 1 件。 */
export interface DetectedBarcode {
  /** 読み取った値。 */
  rawValue: string;
  /** フォーマット(例 "ean_13" / "qr_code")。 */
  format: string;
}

/**
 * BarcodeDetector が使えるか。
 *
 * @returns 使えるなら true。**Chrome 系のみ**(非対応なら、ライブラリ(ZXing など)を使うか、手入力に切り替える)
 */
export function isBarcodeDetectorSupported(): boolean {
  return typeof globalThis !== "undefined" && "BarcodeDetector" in globalThis;
}

/**
 * 画像/映像ソースからバーコードを読み取る(BarcodeDetector API)。
 * 非対応環境では例外ではなく空配列を返す(呼び出し側でフォールバック可能)。
 * @param source ImageBitmapSource(video/canvas/img/ImageBitmap 等)
 * @param formats 対象フォーマット(既定は主要な小売バーコード + QR)
 * @returns 検出したバーコード。**非対応の環境では空配列**(例外にしない)
 */
export async function detectBarcodes(
  source: CanvasImageSource | Blob | ImageData,
  formats: string[] = ["ean_13", "ean_8", "code_128", "qr_code"],
): Promise<DetectedBarcode[]> {
  if (!isBarcodeDetectorSupported()) return [];
  try {
    const Detector = (globalThis as unknown as { BarcodeDetector: new (opts?: { formats?: string[] }) => { detect: (s: unknown) => Promise<{ rawValue: string; format: string }[]> } }).BarcodeDetector;
    const detector = new Detector({ formats });
    const results = await detector.detect(source);
    return results.map((r) => ({ rawValue: r.rawValue, format: r.format }));
  } catch {
    return [];
  }
}
