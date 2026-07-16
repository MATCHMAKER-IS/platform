/**
 * 秒を mm:ss(1 時間以上は h:mm:ss)に整形する。
 *
 *
 * @param seconds 秒数
 * @returns `1:23` 形式(**時間があれば `1:02:03`**)
 */
export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const s = Math.floor(seconds % 60);
  const m = Math.floor((seconds / 60) % 60);
  const h = Math.floor(seconds / 3600);
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`;
}
