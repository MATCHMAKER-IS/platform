/**
 * ブラウザ印刷。任意の HTML・特定要素・ページ全体を印刷する。
 * 非表示 iframe を用いるため、画面遷移せずに「この帳票だけ印刷」ができる。
 * ブラウザ専用。
 * @packageDocumentation
 */
import { AppError, ErrorCode, ok, err, type Result } from "@platform/core";

/** 用紙・余白の指定。 */
export interface PageOptions {
  /** 用紙サイズ(例: "A4", "A4 landscape", "80mm auto")。 */
  size?: string;
  /** 余白(例: "10mm", "10mm 12mm")。 */
  margin?: string;
}

/** `@page` の CSS を生成する。 */
export function pageCss(options: PageOptions = {}): string {
  const { size = "A4", margin = "12mm" } = options;
  return `@page { size: ${size}; margin: ${margin}; }`;
}

/** {@link printHtml} のオプション。 */
export interface PrintOptions {
  /** 印刷ジョブのタイトル(既定のファイル名等に使われる)。 */
  title?: string;
  /** 追加の印刷用 CSS(通常 {@link pageCss} を渡す)。 */
  pageStyle?: string;
}

/**
 * 任意の HTML を印刷する(非表示 iframe 経由・画面遷移なし)。
 * @example
 * ```ts
 * import { renderInvoiceHtml } from "@platform/report";
 * await printHtml(renderInvoiceHtml(doc), { title: "請求書", pageStyle: pageCss({ size: "A4" }) });
 * ```
 */
export function printHtml(html: string, options: PrintOptions = {}): Promise<Result<void>> {
  if (typeof document === "undefined") {
    return Promise.resolve(err(new AppError(ErrorCode.INTERNAL, "ブラウザでのみ印刷できます")));
  }
  return new Promise((resolve) => {
    const iframe = document.createElement("iframe");
    Object.assign(iframe.style, { position: "fixed", right: "0", bottom: "0", width: "0", height: "0", border: "0" });
    document.body.appendChild(iframe);
    const cleanup = () => { setTimeout(() => iframe.remove(), 500); };

    const doc = iframe.contentWindow?.document;
    if (!doc) { iframe.remove(); resolve(err(new AppError(ErrorCode.INTERNAL, "印刷用フレームを生成できませんでした"))); return; }

    const style = options.pageStyle ? `<style>${options.pageStyle}</style>` : "";
    doc.open();
    doc.write(`<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>${options.title ?? ""}</title>${style}</head><body>${html}</body></html>`);
    doc.close();

    const run = () => {
      try {
        const win = iframe.contentWindow!;
        win.focus();
        win.print();
        cleanup();
        resolve(ok(undefined));
      } catch (e) {
        iframe.remove();
        resolve(err(new AppError(ErrorCode.INTERNAL, "印刷に失敗しました", { cause: e })));
      }
    };
    if (doc.readyState === "complete") run();
    else iframe.onload = run;
  });
}

/** ページ全体を印刷する(window.print)。 */
export function printPage(): Result<void> {
  if (typeof window === "undefined") return err(new AppError(ErrorCode.INTERNAL, "ブラウザでのみ印刷できます"));
  window.print();
  return ok(undefined);
}

/** {@link printElement} のオプション。 */
export interface PrintElementOptions extends PrintOptions {
  /** 現在のページのスタイル(style/link)を複製するか(既定 true)。 */
  copyStyles?: boolean;
}

/** 特定の DOM 要素だけを印刷する。 */
export function printElement(element: HTMLElement, options: PrintElementOptions = {}): Promise<Result<void>> {
  if (typeof document === "undefined") {
    return Promise.resolve(err(new AppError(ErrorCode.INTERNAL, "ブラウザでのみ印刷できます")));
  }
  const { copyStyles = true, ...rest } = options;
  let styles = "";
  if (copyStyles) {
    styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map((el) => el.outerHTML)
      .join("\n");
  }
  return printHtml(`${styles}${element.outerHTML}`, rest);
}
