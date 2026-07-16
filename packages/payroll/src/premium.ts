/**
 * 割増賃金の計算(労働基準法・純ロジック)。
 * 時間外・深夜・法定休日の割増率を適用し、区分ごとの割増を積み上げる。
 * 割増は重複する(深夜残業 = 25%+25%、法定休日の深夜 = 35%+25%)。
 * ⚠️ 割増率は法定の最低基準。就業規則でこれ以上に定める場合は rates で上書きする。
 * @packageDocumentation
 */
import type { WorkSplit } from "./worktime.js";

/** 割増率(法定最低基準)。 */
export interface PremiumRates {
  /** 時間外労働(既定 25%)。 */
  overtime: number;
  /** 月 60 時間超の時間外労働(既定 50%・中小企業も 2023/4 から適用)。 */
  overtimeOver60: number;
  /** 深夜労働(既定 25%)。 */
  night: number;
  /** 法定休日労働(既定 35%)。 */
  holiday: number;
}

/** 法定最低の割増率。 */
export const DEFAULT_PREMIUM_RATES: PremiumRates = {
  overtime: 0.25,
  overtimeOver60: 0.5,
  night: 0.25,
  holiday: 0.35,
};

/** 月 60 時間超の割増が適用される閾値(分)。 */
export const OVER60_THRESHOLD_MINUTES = 60 * 60;

/** 賃金の内訳。 */
export interface PayBreakdown {
  /** 通常の労働に対する基本賃金(法定休日ぶんを除く実労働 × 時間単価)。 */
  base: number;
  /** 時間外割増(60時間以内)。 */
  overtimePremium: number;
  /** 月60時間超の時間外割増(超過ぶんの追加)。 */
  over60Premium: number;
  /** 深夜割増。 */
  nightPremium: number;
  /** 法定休日労働の賃金(基本 + 休日割増)。 */
  holidayPay: number;
  /** 合計支給額(割増込み)。 */
  total: number;
}

/** {@link calcPay} の入力(分単位の勤怠区分 + 時間単価)。 */
export interface PayInput {
  /** 時間単価(円)。 */
  hourlyWage: number;
  /** 実労働時間(分)。 */
  totalMinutes: number;
  /** 時間外労働(分)。 */
  overtimeMinutes: number;
  /** 深夜労働(分)。 */
  nightMinutes: number;
  /** 法定休日労働(分)。 */
  holidayMinutes: number;
  /** 月60時間を超えた時間外労働(分)。この分は over60 割増になる。 */
  over60Minutes?: number;
}

/** 分を時間に換算して賃金を計算(円未満は最後に四捨五入)。 */
function pay(hourlyWage: number, minutes: number, rate: number): number {
  return (hourlyWage * minutes / 60) * rate;
}

/**
 * 割増込みの賃金を計算する。
 * モデル: 全ての非休日労働に基本(1.0)、時間外にさらに割増、深夜は全区分に加算、
 * 法定休日は基本+休日割増で別建て(休日には時間外の概念なし)。
 *
 * @param summary 月次の集計
 * @param hourlyRate 時間単価
 * @returns 割増ごとの金額と合計
 */
export function calcPay(input: PayInput, rates: PremiumRates = DEFAULT_PREMIUM_RATES): PayBreakdown {
  const wage = input.hourlyWage;
  const over60 = Math.min(input.over60Minutes ?? 0, input.overtimeMinutes);
  const overtimeNormal = input.overtimeMinutes - over60;

  const base = pay(wage, input.totalMinutes - input.holidayMinutes, 1);
  const overtimePremium = pay(wage, overtimeNormal, rates.overtime);
  const over60Premium = pay(wage, over60, rates.overtimeOver60);
  const nightPremium = pay(wage, input.nightMinutes, rates.night);
  const holidayPay = pay(wage, input.holidayMinutes, 1 + rates.holiday);

  const total = Math.round(base + overtimePremium + over60Premium + nightPremium + holidayPay);
  return {
    base: Math.round(base),
    overtimePremium: Math.round(overtimePremium),
    over60Premium: Math.round(over60Premium),
    nightPremium: Math.round(nightPremium),
    holidayPay: Math.round(holidayPay),
    total,
  };
}

/** 月次の勤怠集計(複数日の合算)。 */
export interface MonthlyAttendance {
  totalMinutes: number;
  overtimeMinutes: number;
  nightMinutes: number;
  holidayMinutes: number;
  /** 60時間を超えた時間外(over60 割増対象)。 */
  over60Minutes: number;
  /** 勤務日数。 */
  workedDays: number;
}

/**
 * 日次の勤怠区分を月次に合算し、月60時間超の時間外を算出する。
 * 給与計算に渡す月次入力を作る。
 *
 * @param days 日次の勤務記録
 * @returns 月次の集計(**時間外・深夜・休日を分けて数える**。割増率が違うため)
 */
export function aggregateMonthly(days: WorkSplit[]): MonthlyAttendance {
  const sum = days.reduce<Omit<MonthlyAttendance, "over60Minutes">>(
    (acc, d) => ({
      totalMinutes: acc.totalMinutes + d.totalMinutes,
      overtimeMinutes: acc.overtimeMinutes + d.overtimeMinutes,
      nightMinutes: acc.nightMinutes + d.nightMinutes,
      holidayMinutes: acc.holidayMinutes + d.holidayMinutes,
      workedDays: acc.workedDays + (d.totalMinutes > 0 ? 1 : 0),
    }),
    { totalMinutes: 0, overtimeMinutes: 0, nightMinutes: 0, holidayMinutes: 0, workedDays: 0 },
  );
  const over60Minutes = Math.max(0, sum.overtimeMinutes - OVER60_THRESHOLD_MINUTES);
  return { ...sum, over60Minutes };
}

/**
 * 割増込みの賃金を計算する。
 *
 * **労基法の割増率**: 時間外 25%(月 60 時間超は 50%)、深夜 25%、休日 35%。
 * **重複する場合は加算**(深夜の時間外は 25% + 25% = 50%)。
 * 率を間違えると未払い賃金になり、遡って請求される。
 *
 * @param summary 月次の集計(時間外・深夜・休日の時間数)
 * @param hourlyRate 時間単価
 * @returns 割増ごとの金額と合計
 */
export function calcMonthlyPay(month: MonthlyAttendance, hourlyWage: number, rates: PremiumRates = DEFAULT_PREMIUM_RATES): PayBreakdown {
  return calcPay(
    {
      hourlyWage,
      totalMinutes: month.totalMinutes,
      overtimeMinutes: month.overtimeMinutes,
      nightMinutes: month.nightMinutes,
      holidayMinutes: month.holidayMinutes,
      over60Minutes: month.over60Minutes,
    },
    rates,
  );
}
