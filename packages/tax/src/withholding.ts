/**
 * 源泉徴収税(報酬・料金等の所得税及び復興特別所得税)の計算。
 * 原稿料・講演料・デザイン料・士業報酬などの支払時に控除する源泉税を算出する。
 *
 * 標準税率(復興特別所得税込み): 支払金額 100万円以下は 10.21%、超過分は 20.42%。
 * 消費税が請求書で明確に区分されている場合、源泉徴収は原則「税抜(報酬本体)」を対象にする。
 * ⚠️ 司法書士・特定の士業など一部は別計算(定額控除後の定率)。その場合は
 * {@link withholdingTaxFlat} を使うこと。
 * @packageDocumentation
 */

/** 標準税率(所得税10% + 復興特別所得税0.21%)。 */
export const WITHHOLDING_RATE_STANDARD = 0.1021;
/** 100万円超部分の税率(20% + 0.42%)。 */
export const WITHHOLDING_RATE_HIGH = 0.2042;
/** 税率が切り替わる支払金額の境界。 */
export const WITHHOLDING_THRESHOLD = 1_000_000;

/**
 * 報酬・料金等の源泉徴収税額を計算する(円未満切り捨て)。
 * @param base 源泉徴収の対象額(通常は税抜の報酬本体)。
 * @returns 源泉徴収税額(円)。
 */
export function withholdingTax(base: number): number {
  if (base <= 0) return 0;
  const tax = base <= WITHHOLDING_THRESHOLD
    ? base * WITHHOLDING_RATE_STANDARD
    : (base - WITHHOLDING_THRESHOLD) * WITHHOLDING_RATE_HIGH + WITHHOLDING_THRESHOLD * WITHHOLDING_RATE_STANDARD;
  return Math.floor(tax);
}

/**
 * 定額控除後に定率を掛ける源泉徴収(司法書士・土地家屋調査士・海事代理士等)。
 * 例: 司法書士報酬は (支払金額 − 1万円) × 10.21%。
 * @param base 支払金額(税抜)。
 * @param deduction 1 回の支払につき控除する額(例: 10000)。
 * @param rate 税率(既定 10.21%)。
 * @returns 源泉徴収税額(円・切り捨て)。控除後がマイナスなら 0
 */
export function withholdingTaxFlat(base: number, deduction: number, rate: number = WITHHOLDING_RATE_STANDARD): number {
  const taxable = Math.max(0, base - deduction);
  return Math.floor(taxable * rate);
}

/** 源泉徴収の内訳。 */
export interface WithholdingResult {
  /** 対象額。 */
  base: number;
  /** 源泉徴収税額。 */
  withholding: number;
  /** 差引支払額(base − withholding)。消費税を別途足す場合は呼び出し側で加算。 */
  net: number;
}

/**
 * 源泉徴収税と差引支払額をまとめて返す。
 *
 * 100 万円を境に税率が変わる(超過分は 20.42%)日本の制度に対応する。
 *
 * @param base 対象額(税抜報酬)
 * @returns 源泉徴収税額と差引支払額
 *
 * @example
 * ```ts
 * applyWithholding(100_000);   // => { tax: 10210, net: 89790 }
 * ```
 */
export function applyWithholding(base: number): WithholdingResult {
  const withholding = withholdingTax(base);
  return { base, withholding, net: base - withholding };
}
