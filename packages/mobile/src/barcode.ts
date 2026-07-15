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

/** EAN-13 / JAN(13桁)として妥当か(チェックディジット検証)。 */
export function isValidEan13(code: string): boolean {
  const c = code.trim();
  if (!isDigits(c) || c.length !== 13) return false;
  return eanCheckDigit(c.slice(0, 12)) === c.charCodeAt(12) - 48;
}

/** JAN コードとして妥当か(日本の JAN は EAN-13。8桁の短縮 JAN も許容)。 */
export function isValidJan(code: string): boolean {
  return isValidEan13(code) || isValidEan8(code);
}

/** EAN-8(8桁)として妥当か。 */
export function isValidEan8(code: string): boolean {
  const c = code.trim();
  if (!isDigits(c) || c.length !== 8) return false;
  return eanCheckDigit(c.slice(0, 7)) === c.charCodeAt(7) - 48;
}

/** バーコード種別の推定。 */
export type BarcodeKind = "ean13" | "ean8" | "unknown";

/** 桁数とチェックディジットから種別を推定する。 */
export function detectBarcodeKind(code: string): BarcodeKind {
  if (isValidEan13(code)) return "ean13";
  if (isValidEan8(code)) return "ean8";
  return "unknown";
}

/** JAN の先頭2〜3桁(国コード)。45/49 は日本。 */
export function janCountryPrefix(code: string): string | null {
  const c = code.trim();
  if (!isDigits(c) || c.length !== 13) return null;
  return c.slice(0, 2);
}

/** 日本の事業者に割り当てられた JAN か(45 または 49 始まり)。 */
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

/** BarcodeDetector が使えるか。 */
export function isBarcodeDetectorSupported(): boolean {
  return typeof globalThis !== "undefined" && "BarcodeDetector" in globalThis;
}

/**
 * 画像/映像ソースからバーコードを読み取る(BarcodeDetector API)。
 * 非対応環境では例外ではなく空配列を返す(呼び出し側でフォールバック可能)。
 * @param source ImageBitmapSource(video/canvas/img/ImageBitmap 等)
 * @param formats 対象フォーマット(既定は主要な小売バーコード + QR)
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
