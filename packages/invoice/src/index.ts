/**
 * `@platform/invoice` — 請求書(適格請求書対応)。明細計算・税率別集計・番号採番・支払期限/入金状態。
 * 税計算は `@platform/tax`(税率区分ごとの端数処理)に委譲する。
 * @packageDocumentation
 */
export * from "./line.js";
export * from "./invoice.js";
export * from "./numbering.js";
export * from "./payment.js";
export * from "./html.js";
export * from "./dunning.js";
export * from "./recurring.js";
export * from "./reconcile.js";
// 適格請求書発行事業者の登録番号(T+13桁)の検証・正規化は税パッケージを再エクスポート
export { isValidInvoiceNumber, normalizeInvoiceNumber } from "@platform/tax";
