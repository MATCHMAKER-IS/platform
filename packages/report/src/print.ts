/**
 * 帳票の印刷/PDF 最適化(純ロジック)。
 * 画面向けに生成した帳票 HTML に @page ルールやページ区切りを与え、PDF 化したときに
 * 用紙サイズ・余白・改ページが正しく効くようにする。複数帳票を 1 つの PDF にまとめる一括出力も。
 * PDF 変換自体は @platform/pdf(fromHtml)に渡す。ここは HTML を整えるだけで pdf に依存しない。
 * @packageDocumentation
 */

/** 印刷/PDF のページ設定。 */
export interface PrintOptions {
  /** 用紙サイズ(既定 A4)。 */
  format?: "A4" | "A3" | "Letter";
  /** 余白(CSS 単位、既定 "15mm")。 */
  margin?: string;
  /** 横向き。 */
  landscape?: boolean;
}

/** @page ルールと印刷向けユーティリティ CSS を生成する。 */
export function printPageCss(options: PrintOptions = {}): string {
  const format = options.format ?? "A4";
  const margin = options.margin ?? "15mm";
  const size = options.landscape ? `${format} landscape` : format;
  return [
    `@page { size: ${size}; margin: ${margin}; }`,
    // 色や背景を印刷時も保持(帳票の罫線・見出し背景)
    `@media print { * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }`,
    // 表の行やセクションが改ページで割れないように
    `table, tr, .no-break { break-inside: avoid; }`,
    `thead { display: table-header-group; }`,
    // 明示的な改ページ用クラス
    `.page-break { break-before: page; }`,
  ].join("\n");
}

/** HTML ドキュメントに印刷用 CSS を差し込む(</head> 直前、無ければ先頭に style を付与)。 */
export function injectPrintCss(html: string, css: string): string {
  const styleTag = `<style data-print="1">\n${css}\n</style>`;
  if (html.includes("</head>")) return html.replace("</head>", `${styleTag}</head>`);
  return `${styleTag}\n${html}`;
}

/** 帳票 HTML を印刷/PDF 向けに整える(@page + 改ページ制御を注入)。 */
export function wrapForPrint(html: string, options: PrintOptions = {}): string {
  return injectPrintCss(html, printPageCss(options));
}

/** HTML ドキュメントから <body> の内側を取り出す(無ければ全体を返す)。 */
function extractBody(html: string): string {
  const m = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(html);
  return m ? m[1]! : html;
}

/**
 * 複数の帳票 HTML を 1 つの印刷ドキュメントに結合する(各帳票を改ページで区切る)。
 * 月次の全請求書を 1 つの PDF にまとめる、といった一括出力に使う。
 */
export function combineForPrint(htmls: string[], options: PrintOptions = {}): string {
  const pages = htmls
    .map((h, i) => `<div class="${i === 0 ? "" : "page-break"}">${extractBody(h)}</div>`)
    .join("\n");
  return `<!doctype html>
<html lang="ja"><head><meta charset="utf-8">
<style data-print="1">
${printPageCss(options)}
</style></head>
<body>
${pages}
</body></html>`;
}

// ─────────────── 各帳票の印刷用ショートカット ───────────────
import type { InvoiceDocument } from "./render.js";
import { renderInvoiceHtml, renderQuotationHtml, renderDeliveryNoteHtml } from "./render.js";

/** 請求書を印刷/PDF 用 HTML で生成する(renderInvoiceHtml + wrapForPrint)。 */
export function printableInvoiceHtml(doc: InvoiceDocument, options: PrintOptions = {}): string {
  return wrapForPrint(renderInvoiceHtml(doc), options);
}
/** 見積書を印刷/PDF 用 HTML で生成する。 */
export function printableQuotationHtml(doc: InvoiceDocument, options: PrintOptions = {}): string {
  return wrapForPrint(renderQuotationHtml(doc), options);
}
/** 納品書を印刷/PDF 用 HTML で生成する。 */
export function printableDeliveryNoteHtml(doc: InvoiceDocument, options: PrintOptions = {}): string {
  return wrapForPrint(renderDeliveryNoteHtml(doc), options);
}
