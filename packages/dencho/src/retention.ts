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
 * @returns 保存期限の日付(**事業年度の終了日 + 保存年数**)
 */
export function retentionDeadline(startDate: Date, years: number = DEFAULT_RETENTION_YEARS): Date {
  const d = new Date(startDate);
  d.setFullYear(d.getFullYear() + years);
  d.setDate(d.getDate() - 1);
  return d;
}

/**
 * 保存義務期間内かを判定する。
 *
 * **法人税法では原則 7 年、欠損金がある事業年度は 10 年**。
 * 期間内のデータを消すと法令違反になる。
 *
 * @param record レコード(事業年度の終了日を持つ)
 * @param asOf 基準日(テスト注入用)
 * @returns 保存義務期間内なら true
 */
export function isWithinRetention(startDate: Date, years: number, now: Date = new Date()): boolean {
  return now.getTime() <= retentionDeadline(startDate, years).getTime();
}

/**
 * 保存期限までの残り日数を返す。
 *
 * @param record レコード
 * @param asOf 基準日(テスト注入用)
 * @returns 残り日数(**過ぎていれば負**)
 */
export function daysUntilRetentionEnd(startDate: Date, years: number, now: Date = new Date()): number {
  const ms = retentionDeadline(startDate, years).getTime() - now.getTime();
  return Math.ceil(ms / 86_400_000);
}
