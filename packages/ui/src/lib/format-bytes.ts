/**
 * バイト数を人間可読な文字列にする(純関数)。
 * @packageDocumentation
 */

/**
 * 例: 1536 → "1.5 KB"。
 *
 *
 * @param bytes バイト数
 * @returns `1.5 MB` 形式(**1024 基準**)
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "-";
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, i);
  const rounded = i === 0 ? String(bytes) : value.toFixed(decimals);
  return `${rounded} ${units[i]}`;
}
