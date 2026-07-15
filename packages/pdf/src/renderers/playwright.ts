/**
 * Playwright(ヘッドレス Chromium)による HTML→PDF レンダラ。
 * 事前に `npx playwright install chromium` が必要。
 * @packageDocumentation
 */
import { chromium, type Browser } from "playwright";
import type { PdfRenderer, PdfOptions } from "../index.js";

/**
 * Playwright レンダラを作る。1 ブラウザを使い回す。
 * @returns {@link PdfRenderer} 実装
 */
export function createPlaywrightRenderer(): PdfRenderer {
  let browser: Browser | null = null;
  async function getBrowser(): Promise<Browser> {
    if (!browser) browser = await chromium.launch();
    return browser;
  }
  return {
    async render(html: string, options?: PdfOptions) {
      const b = await getBrowser();
      const page = await b.newPage();
      try {
        await page.setContent(html, { waitUntil: "networkidle" });
        const buf = await page.pdf({
          format: options?.format ?? "A4",
          landscape: options?.landscape ?? false,
          printBackground: true,
          margin: options?.margin,
        });
        return new Uint8Array(buf);
      } finally {
        await page.close();
      }
    },
    async close() {
      if (browser) {
        await browser.close();
        browser = null;
      }
    },
  };
}
