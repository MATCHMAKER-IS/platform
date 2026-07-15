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
 */
export function retentionDeadline(startDate: Date, years: number = DEFAULT_RETENTION_YEARS): Date {
  const d = new Date(startDate);
  d.setFullYear(d.getFullYear() + years);
  d.setDate(d.getDate() - 1);
  return d;
}

/** 指定日時点でまだ保存義務期間内か。 */
export function isWithinRetention(startDate: Date, years: number, now: Date = new Date()): boolean {
  return now.getTime() <= retentionDeadline(startDate, years).getTime();
}

/** 保存期限までの残り日数(過ぎていれば負)。 */
export function daysUntilRetentionEnd(startDate: Date, years: number, now: Date = new Date()): number {
  const ms = retentionDeadline(startDate, years).getTime() - now.getTime();
  return Math.ceil(ms / 86_400_000);
}
