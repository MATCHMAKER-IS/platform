/**
 * モバイルのブラウザ操作(feature detection つきラッパー)。
 * 共有・触覚・クリップボード・PWA 判定など。非対応環境でも安全に false を返す。
 * @packageDocumentation
 */

/**
 * Web Share API が使えるかを判定する。
 *
 * **モバイルのみ**(デスクトップはほぼ非対応)。非対応なら、
 * URL のコピーなど代替を用意すること。
 *
 * @returns 使えるなら true
 */
export function canShare(): boolean {
  return typeof navigator !== "undefined" && typeof (navigator as unknown as { share?: unknown }).share === "function";
}

/**
 * ネイティブの共有シートを開く(Web Share API)。非対応なら false を返す。
 *
 * @param data 共有する内容(タイトル・テキスト・URL)
 * @returns 成功したか。**利用者がキャンセルしても false**(エラーではない)
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

/**
 * 触覚フィードバック(バイブレーション)を出す。
 *
 * **iOS Safari は非対応**(Android のみ)。**利用者の操作から呼ばないと無視される**。
 * 使いすぎると鬱陶しいので、重要な操作(決済完了・エラー)に絞ること。
 *
 * @param pattern ミリ秒、または `[振動, 停止, 振動]` の配列
 * @returns 成功したか。**非対応なら false**
 */
export function vibrate(pattern: number | number[]): boolean {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return false;
  return navigator.vibrate(pattern);
}

/**
 * クリップボードにコピーする。
 *
 * **HTTPS でないと失敗する**(Clipboard API の制約)。
 *
 * @param text コピーする文字列
 * @returns 成功したか
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.clipboard) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * PWA としてホーム画面から起動されているかを判定する。
 *
 * **ブラウザの UI(戻るボタン・URL バー)が無い**ので、
 * アプリ内に戻る手段を用意する必要がある。
 *
 * @returns スタンドアロン起動なら true
 */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const mm = window.matchMedia?.("(display-mode: standalone)")?.matches;
  const iosStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return !!mm || iosStandalone;
}

/**
 * タッチ操作が主かを推定する(`coarse pointer`)。
 *
 * **画面幅では判断できない**(大きいタブレットも、小さいノート PC もある)。
 * タップ領域を広げるかの判断はこちらで。
 *
 * @returns タッチが主なら true
 */
export function isTouchPrimary(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(pointer: coarse)").matches;
}
