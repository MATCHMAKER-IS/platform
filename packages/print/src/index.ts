/**
 * `@platform/print` — 印刷処理。
 *
 * - ブラウザ印刷: {@link printHtml} / {@link printElement} / {@link printPage}(非表示 iframe 経由)
 * - 印刷用 CSS: {@link pageCss}
 * - レシート(サーマルプリンタ): {@link createReceipt}(ESC/POS バイト列)
 *
 * @packageDocumentation
 */
export {
  printHtml, printElement, printPage, pageCss,
  type PageOptions, type PrintOptions, type PrintElementOptions,
} from "./browser";
export { createReceipt, type ReceiptBuilder, type Align } from "./escpos";
export { connectReceiptPrinter, RECEIPT_PROFILES, type ReceiptPrinter, type ReceiptPrinterProfile } from "./receipt-bluetooth";
