/**
 * クーポン・割引(純ロジック)。
 * 定率(%)・定額(円)の割引を、最低購入額・割引上限を考慮して計算する。
 * @packageDocumentation
 */

/** 割引の種類。 */
export type DiscountType = "percentage" | "fixed";

/** クーポン。 */
export interface Coupon {
  /** クーポンコード。 */
  code: string;
  /** 種類。 */
  type: DiscountType;
  /** 値(percentage は 0..100、fixed は円)。 */
  value: number;
  /** 最低購入額(これ未満は適用不可)。 */
  minPurchase?: number;
  /** 割引上限(percentage のとき有効)。 */
  maxDiscount?: number;
}

/** クーポンが適用可能か(最低購入額を満たすか)。 */
export function isCouponApplicable(coupon: Coupon, subtotal: number): boolean {
  return subtotal > 0 && (coupon.minPurchase === undefined || subtotal >= coupon.minPurchase);
}

/**
 * 割引額を計算する(小計を超えず、上限・最低購入額を考慮。1 円未満は切り捨て)。
 * 適用不可なら 0。
 */
export function computeDiscount(coupon: Coupon, subtotal: number): number {
  if (!isCouponApplicable(coupon, subtotal)) return 0;
  let discount: number;
  if (coupon.type === "percentage") {
    discount = subtotal * (Math.max(0, Math.min(100, coupon.value)) / 100);
    if (coupon.maxDiscount !== undefined) discount = Math.min(discount, coupon.maxDiscount);
  } else {
    discount = Math.max(0, coupon.value);
  }
  return Math.floor(Math.min(discount, subtotal));
}

/** 割引後の小計を返す。 */
export function applyDiscount(subtotal: number, coupon: Coupon): number {
  return subtotal - computeDiscount(coupon, subtotal);
}
