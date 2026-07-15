/**
 * `@platform/pdf` — 帳票 PDF 生成(HTML → PDF)。
 *
 * 請求書・報告書などの帳票は、HTML/CSS でレイアウトして PDF 化するのが
 * 日本語フォント・表組みの都合で最も扱いやすい。レンダラは差し替え可能
 * (本番は Playwright、テストはスタブ)で、呼び出し側は無変更。
 *
 * @packageDocumentation
 */

import { AppError, ErrorCode, tryCatch, type Result } from "@platform/core";

/** PDF 化のオプション。 */
export interface PdfOptions {
  /** 用紙サイズ(既定: "A4")。 */
  format?: "A4" | "A3" | "Letter";
  /** 余白(CSS 単位、例: "20mm")。 */
  margin?: { top?: string; right?: string; bottom?: string; left?: string };
  /** 横向きにするか。 */
  landscape?: boolean;
}

/** HTML→PDF レンダラの抽象(Adapter)。 */
export interface PdfRenderer {
  render(html: string, options?: PdfOptions): Promise<Uint8Array>;
  /** リソース解放(ブラウザ終了等)。 */
  close(): Promise<void>;
}

/** アプリが使う帳票生成口。 */
export interface PdfService {
  /**
   * HTML 文字列を PDF に変換する。
   * @param html 完成した HTML(日本語フォント指定込み)
   * @param options 用紙・余白・向き
   * @returns PDF バイナリの `ok`、失敗なら `INTERNAL` の `err`
   */
  fromHtml(html: string, options?: PdfOptions): Promise<Result<Uint8Array>>;
}

/**
 * レンダラを注入して PdfService を作る。
 * @param renderer {@link createPlaywrightRenderer} 等
 * @returns {@link PdfService}
 *
 * @example
 * ```ts
 * const pdf = createPdf(createPlaywrightRenderer());
 * const res = await pdf.fromHtml(invoiceHtml, { format: "A4" });
 * if (res.ok) await storage.put("invoices/2026-01.pdf", res.value);
 * await renderer.close();
 * ```
 */
export function createPdf(renderer: PdfRenderer): PdfService {
  return {
    async fromHtml(html, options) {
      const res = await tryCatch(() => renderer.render(html, options));
      return res.ok
        ? res
        : {
            ok: false,
            error: new AppError(ErrorCode.INTERNAL, "PDF生成に失敗しました", {
              cause: res.error.cause ?? res.error,
            }),
          };
    },
  };
}

/**
 * PDF 化の既定オプション(帳票向け・A4/15mm 余白)。
 * report の wrapForPrint と併用する場合、余白は CSS @page が優先されるが、
 * レンダラ側の既定としても A4 を指定しておく。
 */
export const DEFAULT_INVOICE_PDF_OPTIONS: PdfOptions = { format: "A4", margin: { top: "15mm", right: "15mm", bottom: "15mm", left: "15mm" } };

export { createPlaywrightRenderer } from "./renderers/playwright.js";
