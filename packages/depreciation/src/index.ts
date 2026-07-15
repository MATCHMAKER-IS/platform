/**
 * 固定資産の減価償却計算。
 *
 * - 定額法（straight_line）: 取得価額 ÷ 耐用年数 を毎期償却し、最終年度は残存簿価1円（備忘価額）まで。
 * - 定率法（declining_balance）: 期首簿価 × 償却率（既定は 200%定率法 = 2 ÷ 耐用年数）。
 *   各期、残存年数での均等額（定額）を下回ったら定額へ切り替え、耐用年数内に1円まで償却しきる。
 *
 * すべて円未満切り捨て。取得年度も1年分（暦年ベース）として計算する（月割は {@link monthlyAmount}）。
 * @packageDocumentation
 */

/** 償却方法。 */
export type DepreciationMethod = "straight_line" | "declining_balance";

/** 償却対象の資産。 */
export interface DepreciableAsset {
  /** 取得価額（円）。 */
  cost: number;
  /** 耐用年数（年）。 */
  usefulLifeYears: number;
  /** 償却方法。 */
  method: DepreciationMethod;
  /** 定率法の償却率（未指定なら 2 ÷ 耐用年数）。 */
  rate?: number;
}

/** 償却スケジュールの1年分。 */
export interface ScheduleRow {
  /** 年度（西暦）。 */
  year: number;
  /** その年の償却額。 */
  depreciation: number;
  /** 償却累計額。 */
  accumulated: number;
  /** 期末簿価。 */
  bookValue: number;
}

/** 備忘価額（残存簿価）。 */
export const MEMORANDUM_VALUE = 1;

/** 定額法の償却率（1 ÷ 耐用年数）。 */
export function straightLineRate(usefulLifeYears: number): number {
  return usefulLifeYears > 0 ? 1 / usefulLifeYears : 0;
}

/** 定率法の既定償却率（200%定率法 = 2 ÷ 耐用年数）。 */
export function decliningBalanceRate(usefulLifeYears: number): number {
  return usefulLifeYears > 0 ? 2 / usefulLifeYears : 0;
}

function isLastMeaningfulYear(yearIndex: number, life: number): boolean {
  return yearIndex >= life - 1;
}

/** 定額法の年次スケジュール（取得価額を耐用年数で均等償却、最終年度に1円まで）。 */
export function straightLineSchedule(cost: number, usefulLifeYears: number, startYear: number): ScheduleRow[] {
  const rows: ScheduleRow[] = [];
  if (cost <= MEMORANDUM_VALUE || usefulLifeYears <= 0) return rows;
  const annual = Math.floor(cost / usefulLifeYears);
  let book = cost;
  let accumulated = 0;
  for (let i = 0; i < usefulLifeYears; i++) {
    let dep = annual;
    if (isLastMeaningfulYear(i, usefulLifeYears)) dep = book - MEMORANDUM_VALUE;
    if (dep > book - MEMORANDUM_VALUE) dep = book - MEMORANDUM_VALUE;
    if (dep < 0) dep = 0;
    book -= dep;
    accumulated += dep;
    rows.push({ year: startYear + i, depreciation: dep, accumulated, bookValue: book });
  }
  return rows;
}

/** 定率法の年次スケジュール（期首簿価×償却率、残存年数の均等額を下回れば定額へ切替、1円まで）。 */
export function decliningBalanceSchedule(cost: number, usefulLifeYears: number, startYear: number, rate?: number): ScheduleRow[] {
  const rows: ScheduleRow[] = [];
  if (cost <= MEMORANDUM_VALUE || usefulLifeYears <= 0) return rows;
  const r = rate ?? decliningBalanceRate(usefulLifeYears);
  let book = cost;
  let accumulated = 0;
  for (let i = 0; i < usefulLifeYears; i++) {
    const remainingYears = usefulLifeYears - i;
    const dbAmount = Math.floor(book * r);
    const evenAmount = Math.floor((book - MEMORANDUM_VALUE) / remainingYears);
    let dep = Math.max(dbAmount, evenAmount);
    if (isLastMeaningfulYear(i, usefulLifeYears) || dep > book - MEMORANDUM_VALUE) dep = book - MEMORANDUM_VALUE;
    if (dep < 0) dep = 0;
    book -= dep;
    accumulated += dep;
    rows.push({ year: startYear + i, depreciation: dep, accumulated, bookValue: book });
  }
  return rows;
}

/** 方法に応じて償却スケジュールを作る。 */
export function depreciationSchedule(asset: DepreciableAsset, startYear: number): ScheduleRow[] {
  return asset.method === "declining_balance"
    ? decliningBalanceSchedule(asset.cost, asset.usefulLifeYears, startYear, asset.rate)
    : straightLineSchedule(asset.cost, asset.usefulLifeYears, startYear);
}

/** スケジュールから指定年度の期末簿価を返す（取得前は取得価額、償却後は最終簿価）。 */
export function bookValueAt(schedule: ScheduleRow[], year: number, cost: number): number {
  if (schedule.length === 0) return cost;
  if (year < schedule[0]!.year) return cost;
  let book = cost;
  for (const row of schedule) {
    if (row.year > year) break;
    book = row.bookValue;
  }
  return book;
}

/** スケジュールから指定年度の償却額を返す（該当年度が無ければ0）。 */
export function depreciationInYear(schedule: ScheduleRow[], year: number): number {
  return schedule.find((r) => r.year === year)?.depreciation ?? 0;
}

/** 年間償却額の月割（円未満切り捨て）。 */
export function monthlyAmount(annual: number): number {
  return Math.floor(annual / 12);
}
