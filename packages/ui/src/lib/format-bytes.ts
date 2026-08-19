/**
 * バイト数を人間可読な文字列にする(純関数)。
 *
 * **画面向けの版。** `@platform/utils` の `formatBytes` とは扱いが違う:
 *
 * - **負値と `NaN` は `"-"`** … ファイルサイズが負になることは無いので、
 *   `-1 B` と出すより**「不明」と分かる方がよい**
 * - **上限は TB** … PB を出しても画面では読めない
 *
 * - **桁を落とさない** … `1.0 KB` と出す。`utils` は `1 KB`
 *
 * **桁を落とさないのは意図**(2026-08 に確認)——一覧に並べたとき
 * **小数点の位置が揃って読みやすい**。`utils` 版は文中に埋め込む用途なので落とす。
 * **どちらも正しく、揃える必要は無い**。
 *
 * ただし**同じ画面で両方を使わないこと**——`1.0 KB` と `1 KB` が混ざる。
 *
 * @packageDocumentation
 */

/**
 * バイト数を `1.5 MB` の形にする。
 *
 * @param bytes バイト数
 * @param decimals 小数点以下の桁数(既定 1)
 * @returns 「1.5 MB」形式(**桁は落とさない**。`1.0 KB`)。**負値・`NaN` は `"-"`**、0 なら「0 B」
 */
export function formatBytes(bytes: number, decimals = 1): string {
  // **負値と NaN は「不明」。** ファイルサイズが負になることは無い
  if (!Number.isFinite(bytes) || bytes < 0) return "-";
  if (bytes === 0) return "0 B";
  // **上限は TB。** PB を出しても画面では読めない
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const v = Math.round((bytes / 1024 ** i) * 10 ** decimals) / 10 ** decimals;
  // **B は小数を付けない。** `500.0 B` は意味が無い(1 バイト未満は存在しない)。
  // KB 以上は**桁を落とさない**——一覧で小数点の位置が揃う(`utils` 版とはここが違う)
  return (i === 0 ? String(v) : v.toFixed(decimals)) + " " + units[i];
}
