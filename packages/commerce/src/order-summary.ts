/**
 * 注文サマリ(会計計算・純ロジック)。
 * カート小計に割引・送料・消費税を適用し、合計を出す。外税/内税に対応。
 * 消費税計算は @platform/tax(taxAmount/taxFromGross)に委ねる。
 * @packageDocumentation
 */
import { taxAmount, taxFromGross } from "@platform/tax";

/** 税の扱い。exclusive=外税(税抜価格に加算), inclusive=内税(価格に税込)。 */
export type TaxMode = "exclusive" | "inclusive";

/** {@link buildOrderSummary} の入力。 */
export interface OrderSummaryInput {
  /** カート小計。 */
  subtotal: number;
  /** 割引額(クーポン等)。 */
  discount?: number;
  /** 送料(税の扱いは taxMode に従わず、税込で渡すことを推奨)。 */
  shippingFee?: number;
  /** 消費税率(%・既定 10)。軽減税率は 8 を指定。 */
  taxRate?: number;
  /** 外税/内税(既定 exclusive=外税)。 */
  taxMode?: TaxMode;
}

/** 注文サマリ。 */
export interface OrderSummary {
  /** 小計(割引前)。 */
  subtotal: number;
  /** 割引額。 */
  discount: number;
  /** 割引後小計。 */
  discountedSubtotal: number;
  /** 送料。 */
  shippingFee: number;
  /** 消費税額。 */
  tax: number;
  /** 請求合計。 */
  total: number;
}

/**
 * 注文サマリを組み立てる。
 * 外税: 税 = 割引後小計 × 税率、合計 = 割引後小計 + 税 + 送料。
 * 内税: 税 = 割引後小計に含まれる税、合計 = 割引後小計 + 送料。
 */
export function buildOrderSummary(input: OrderSummaryInput): OrderSummary {
  const discount = Math.max(0, input.discount ?? 0);
  const discountedSubtotal = Math.max(0, input.subtotal - discount);
  const shippingFee = Math.max(0, input.shippingFee ?? 0);
  const rate = input.taxRate ?? 10;
  const mode = input.taxMode ?? "exclusive";

  if (mode === "inclusive") {
    const tax = taxFromGross(discountedSubtotal, rate as never);
    return { subtotal: input.subtotal, discount, discountedSubtotal, shippingFee, tax, total: discountedSubtotal + shippingFee };
  }
  const tax = taxAmount(discountedSubtotal, rate as never);
  return { subtotal: input.subtotal, discount, discountedSubtotal, shippingFee, tax, total: discountedSubtotal + tax + shippingFee };
}

/** 送料無料の閾値に達しているか。 */
export function qualifiesForFreeShipping(subtotal: number, threshold: number): boolean {
  return subtotal >= threshold;
}

/** 送料を決める(閾値以上なら 0、未満なら通常送料)。 */
export function resolveShippingFee(subtotal: number, threshold: number, normalFee: number): number {
  return qualifiesForFreeShipping(subtotal, threshold) ? 0 : normalFee;
}

/** 送料無料まであといくらか(達していれば 0)。 */
export function amountUntilFreeShipping(subtotal: number, threshold: number): number {
  return Math.max(0, threshold - subtotal);
}
