/**
 * `@platform/invoice` — 請求書(適格請求書対応)。明細計算・税率別集計・番号採番・支払期限/入金状態。
 * 税計算は `@platform/tax`(税率区分ごとの端数処理)に委譲する。
 * @packageDocumentation
 */
export * from "./line";
export * from "./invoice";
export * from "./numbering";
export * from "./payment";
export * from "./html";
export * from "./dunning";
export * from "./recurring";
export * from "./reconcile";
// 適格請求書発行事業者の登録番号(T+13桁)の検証・正規化は税パッケージを再エクスポート
// 税まわりは @platform/tax が実装元。ただし invoice を入口にする利用者
// (@platform/quote / @platform/purchase)が「税計算の設定」を書けるよう、
// 引数に必要な型はここから通す。これが無いと利用側が TS2305 で落ちる。
export { isValidInvoiceNumber, normalizeInvoiceNumber, type Rounding, type TaxRate, type TaxSummary } from "@platform/tax";
