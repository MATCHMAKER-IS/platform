/**
 * 帳票 PDF 生成の口。実際の HTML→PDF 変換は @platform/pdf にレンダラを注入して行う。
 * この環境ではヘッドレスブラウザを利用できないため、レンダラが設定されていなければ null を返す。
 * 併せて、ブラウザの「印刷 → PDF 保存」で綺麗に出力できるよう印刷用 CSS でラップするヘルパを提供する。
 * @packageDocumentation
 */
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

/** 印刷用 CSS（A4・@page 余白）でラップし、ブラウザの印刷から PDF 保存しやすくする。 */
export function wrapForPrint(innerHtml: string, title: string): string {
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>${title}</title>
<style>
  @page { size: A4; margin: 15mm; }
  @media print { .no-print { display: none !important; } }
  body { font-family: -apple-system, "Hiragino Sans", "Noto Sans JP", sans-serif; color: #111; }
</style></head><body>
<div class="no-print" style="text-align:right;padding:8px"><button onclick="window.print()">印刷 / PDF 保存</button></div>
${innerHtml}
</body></html>`;
}
