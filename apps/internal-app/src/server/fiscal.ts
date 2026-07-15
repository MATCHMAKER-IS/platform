/**
 * 会計年度（年度）の判定。決算月（fiscalClosingMonth）に基づき、日付がどの年度に属するかを求める。純粋関数のみ。
 * 年度は開始年でラベル付けする（例: 決算月3月なら 4月〜翌3月を同一年度とし、開始年で表す）。
 * @packageDocumentation
 */

/** 日付（YYYY-MM-DD）が属する会計年度（開始年）。決算月の翌月が年度開始。 */
export function fiscalYearOf(date: string, closingMonth: number): number {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const startMonth = (closingMonth % 12) + 1;
  return month >= startMonth ? year : year - 1;
}

/** 日付が指定の会計年度に属するか。 */
export function inFiscalYear(date: string, fiscalYear: number, closingMonth: number): boolean {
  return fiscalYearOf(date, closingMonth) === fiscalYear;
}

/** 会計年度の期間（開始日・終了日、YYYY-MM-DD）。 */
export function fiscalYearRange(fiscalYear: number, closingMonth: number): { start: string; end: string } {
  const startMonth = (closingMonth % 12) + 1;
  const pad = (n: number) => String(n).padStart(2, "0");
  const start = `${fiscalYear}-${pad(startMonth)}-01`;
  // 終了は開始の1年後の前日 = (fiscalYear+1)年 closingMonth 月末。closingMonth の翌月1日から1日戻す代わりに月末日を求める。
  const endYear = startMonth === 1 ? fiscalYear : fiscalYear + 1;
  const endMonthLastDay = new Date(Date.UTC(endYear, closingMonth, 0)).getUTCDate();
  const end = `${endYear}-${pad(closingMonth)}-${pad(endMonthLastDay)}`;
  return { start, end };
}
