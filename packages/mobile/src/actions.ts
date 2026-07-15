/**
 * モバイルのブラウザ操作(feature detection つきラッパー)。
 * 共有・触覚・クリップボード・PWA 判定など。非対応環境でも安全に false を返す。
 * @packageDocumentation
 */

/** Web Share が使えるか。 */
export function canShare(): boolean {
  return typeof navigator !== "undefined" && typeof (navigator as unknown as { share?: unknown }).share === "function";
}

/**
 * ネイティブの共有シートを開く(Web Share API)。非対応なら false を返す。
 */
export async function share(data: { title?: string; text?: string; url?: string }): Promise<boolean> {
  if (!canShare()) return false;
  try {
    await (navigator as unknown as { share: (d: unknown) => Promise<void> }).share(data);
    return true;
  } catch {
    return false; // ユーザーキャンセル含む
  }
}

/** 触覚フィードバック(バイブレーション)。pattern はミリ秒 or 配列。非対応なら false。 */
export function vibrate(pattern: number | number[]): boolean {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return false;
  return navigator.vibrate(pattern);
}

/** クリップボードにテキストをコピーする。非対応・失敗なら false。 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.clipboard) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** PWA としてホーム画面から起動されているか(standalone 判定)。 */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const mm = window.matchMedia?.("(display-mode: standalone)")?.matches;
  const iosStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return !!mm || iosStandalone;
}

/** タッチ操作が主と推定されるか(coarse pointer)。 */
export function isTouchPrimary(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(pointer: coarse)").matches;
}
