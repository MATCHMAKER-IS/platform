/**
 * 給与明細の組み立て。割増込みの賃金(premium の PayBreakdown)に諸手当・控除を足し引きし、
 * 総支給額・控除合計・差引支給額を出す。
 * ⚠️ 社会保険料・所得税などの控除額は料率・等級で変わるため、算出済みの金額を受け取る形にしている
 * (源泉徴収の計算は @platform/tax の withholdingTax を利用可)。
 * @packageDocumentation
 */
import type { PayBreakdown } from "./premium.js";

/** 手当・控除の項目。 */
export interface PayslipItem {
  /** 名称(例 "通勤手当" / "健康保険料")。 */
  name: string;
  /** 金額(円)。 */
  amount: number;
}

/** 給与明細。 */
export interface Payslip {
  /** 基本賃金(実労働ぶん)。 */
  base: number;
  /** 割増合計(時間外+深夜+休日など)。 */
  premiums: number;
  /** 諸手当。 */
  allowances: PayslipItem[];
  /** 総支給額(基本 + 割増 + 手当)。 */
  grossPay: number;
  /** 控除。 */
  deductions: PayslipItem[];
  /** 控除合計。 */
  totalDeductions: number;
  /** 差引支給額(総支給 − 控除)。 */
  netPay: number;
}

/**
 * 給与明細を組み立てる。
 * @param breakdown 割増込みの賃金(calcPay / calcMonthlyPay の結果)
 * @param options 諸手当・控除(算出済みの金額)
 * @returns 給与明細(**支給・控除・差引支給額**。法定の記載事項を満たす)
 */
export function buildPayslip(
  breakdown: PayBreakdown,
  options: { allowances?: PayslipItem[]; deductions?: PayslipItem[] } = {},
): Payslip {
  const allowances = options.allowances ?? [];
  const deductions = options.deductions ?? [];
  const premiums = breakdown.overtimePremium + breakdown.over60Premium + breakdown.nightPremium + breakdown.holidayPay;
  const allowanceTotal = allowances.reduce((s, a) => s + a.amount, 0);
  const grossPay = breakdown.base + premiums + allowanceTotal;
  const totalDeductions = deductions.reduce((s, d) => s + d.amount, 0);
  return {
    base: breakdown.base,
    premiums,
    allowances,
    grossPay,
    deductions,
    totalDeductions,
    netPay: grossPay - totalDeductions,
  };
}
