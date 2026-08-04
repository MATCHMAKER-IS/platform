/**
 * 帳票 PDF 生成の口。実際の HTML→PDF 変換は @platform/pdf にレンダラを注入して行う。
 * この環境ではヘッドレスブラウザを利用できないため、レンダラが設定されていなければ null を返す。
 * 併せて、ブラウザの「印刷 → PDF 保存」で綺麗に出力できるよう印刷用 CSS でラップするヘルパを提供する。
 * @packageDocumentation
 */
import { printPageCss } from "@platform/report";
import { createPdf, DEFAULT_INVOICE_PDF_OPTIONS, type PdfService, type PdfRenderer } from "@platform/pdf";

/** 環境変数などからレンダラを解決する。未設定なら null（PDF 生成不可）。 */
export function resolvePdfRenderer(): PdfRenderer | null {
  // 実運用では createPlaywrightRenderer() 等をここで返す。
  return null;
}

/** レンダラが設定されていれば PdfService を返す。 */
export function getPdfService(renderer: PdfRenderer | null = resolvePdfRenderer()): PdfService | null {
  return renderer ? createPdf(renderer) : null;
}

/** 既定の PDF オプション（A4・15mm 余白）。 */
export { DEFAULT_INVOICE_PDF_OPTIONS };

/**
 * 印刷用の HTML ドキュメントに包む(ブラウザの印刷から PDF 保存できる形)。
 *
 * **用紙設定(`@page`)は基盤の実装を使う**(`@platform/report` の `printPageCss`)
 * (A4・余白・色の保持といった印刷の作法は基盤が持つ)。
 * ここが足すのは**このアプリのガワ**だけ: 文書の骨組みと、画面上の印刷ボタン。
 *
 * 基盤の `wrapForPrint` は「既存の HTML に CSS を差し込む」もので、
 * HTML ドキュメント全体を組み立てるわけではないため、用途が違う。
 */
export function wrapForPrint(innerHtml: string, title: string): string {
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>${title}</title>
<style>
${printPageCss({ format: "A4", margin: "15mm" })}
  @media print { .no-print { display: none !important; } }
  body { font-family: -apple-system, "Hiragino Sans", "Noto Sans JP", sans-serif; color: #111; }
</style></head><body>
<div class="no-print" style="text-align:right;padding:8px"><button onclick="window.print()">印刷 / PDF 保存</button></div>
${innerHtml}
</body></html>`;
}
