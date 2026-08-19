/**
 * 保存期間の管理(電子帳簿保存法・国税関係帳簿書類は原則 7 年、欠損金があると最長 10 年)。
 * 保存起算日(その事業年度の確定申告期限の翌日)から保存期限を求める。
 * @packageDocumentation
 */

/** 既定の保存年数(国税関係帳簿書類の原則)。 */
export const DEFAULT_RETENTION_YEARS = 7;

/**
 * 保存期限を求める。起算日から years 年後の前日まで。
 * @param startDate 保存の起算日(申告期限の翌日など)
 * @param years 保存年数（既定は法人税法の原則 7 年）
 * @returns 保存期限の日付(**事業年度の終了日 + 保存年数**)
 */
export function retentionDeadline(startDate: Date, years: number = DEFAULT_RETENTION_YEARS): Date {
  // **UTC で通す。** `setFullYear` / `setDate` はサーバのローカル時刻で動くので、
  // JST 機と UTC 機で**保存期限が 1 日ずれる**——法定の保存期間なので、
  // 早く消せば法令違反、遅く消せば個人情報を余計に持ち続けることになる。
  // うるう年の 2/29 は、`setUTCFullYear` が 3/1 に送るのではなく 2/28 に丸める
  // (7 年後・10 年後が必ずうるう年とは限らないため)(2026-08 に修正)。
  const d = new Date(startDate);
  const day = d.getUTCDate();
  d.setUTCDate(1);                       // 月末の繰り上がりを防ぐ
  d.setUTCFullYear(d.getUTCFullYear() + years);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  d.setUTCDate(d.getUTCDate() - 1);
  return d;
}

/**
 * 保存義務期間内かを判定する。
 *
 * **法人税法では原則 7 年、欠損金がある事業年度は 10 年**。
 * 期間内のデータを消すと法令違反になる。
 *
 * @param startDate 保存の起算日(**事業年度の終了日**。レコードそのものではない)
 * @param years 保存年数(法人税法では原則 7 年、欠損金がある事業年度は 10 年)
 * @param now 現在時刻(**テスト注入用**。渡さなければ `new Date()`)
 * @returns 保存義務期間内なら true
 */
export function isWithinRetention(startDate: Date, years: number, now: Date = new Date()): boolean {
  return now.getTime() <= retentionDeadline(startDate, years).getTime();
}

/**
 * 保存期限までの残り日数を返す。
 *
 * @param startDate 保存の起算日(**事業年度の終了日**。レコードそのものではない)
 * @param years 保存年数
 * @param now 現在時刻(テスト注入用)
 * @returns 残り日数(**過ぎていれば負**)
 */
export function daysUntilRetentionEnd(startDate: Date, years: number, now: Date = new Date()): number {
  const ms = retentionDeadline(startDate, years).getTime() - now.getTime();
  return Math.ceil(ms / 86_400_000);
}
