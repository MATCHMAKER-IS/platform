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

/**
 * `@page` の CSS を生成する。
 *
 * **画面用の CSS のままでは紙に収まらない**(余白・改ページ・背景色の扱いが違う)。
 *
 * @param options.size 用紙(既定 A4)
 * @param options.margin 余白。**向きは `size` に含める**(`A4 landscape` のように書く)
 * @returns CSS 文字列
 */
export function pageCss(options: PageOptions = {}): string {
  const { size = "A4", margin = "12mm" } = options;
  // **印刷でしか起きないことを既定で塞ぐ。** どちらも画面では分からず、
  // **紙に出して初めて気づく**(2026-08 に追加)。
  //
  // ① `print-color-adjust: exact` … ブラウザは既定で**背景色を出さない**
  //    (インクの節約)。表の見出し行が白くなり、**どこが見出しか分からない**
  //    ——請求書や納品書では行の区切りが読めなくなる。
  // ② `break-inside: avoid` … 表の行が**上下のページに分かれる**のを防ぐ。
  // ③ `thead { display: table-header-group }` … **見出し行を各ページに繰り返す**。
  //    2 ページ目以降で「この列は何か」が分からなくなるのを防ぐ。
  return [
    `@page { size: ${size}; margin: ${margin}; }`,
    "@media print {",
    "  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }",
    "  tr, li { break-inside: avoid; }",
    "  thead { display: table-header-group; }",
    "}",
  ].join("\n");
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
 *
 * @param html 印刷する HTML
 * @param options 用紙・向き・余白
 * @returns なし(**別ウィンドウを開いて印刷する**)
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

/**
 * ページ全体を印刷する。
 *
 * @returns なし(**印刷ダイアログが開く**)
 */
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

/**
 * 特定の要素だけを印刷する。
 *
 * **画面のヘッダやナビを紙に出さない**ため。一時的に他を隠して印刷し、元に戻す。
 *
 * @param element 印刷する要素
 * @param options 用紙・向き・余白
 * @returns なし
 */
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
