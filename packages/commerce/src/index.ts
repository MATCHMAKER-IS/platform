/**
 * `@platform/commerce` — EC サイトの基盤処理。
 * カート・お気に入り・クーポン割引・注文サマリ(消費税/送料)・在庫引当の純ロジック部品。
 * 決済は @platform/stripe・@platform/paypal、通貨は @platform/currency、消費税は @platform/tax、
 * 注文番号は @platform/sequence、注文ステータスは @platform/fsm と組み合わせる。
 * @packageDocumentation
 */
export * from "./cart.js";
export * from "./favorites.js";
export * from "./discount.js";
export * from "./order-summary.js";
export * from "./inventory.js";
export * from "./variant.js";
export * from "./review.js";
export * from "./order-status.js";
export * from "./points.js";
export * from "./shipping.js";
