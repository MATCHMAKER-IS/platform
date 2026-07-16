/**
 * HTML サニタイズ。ユーザー入力の HTML を安全化する。
 * リッチテキスト表示や、@platform/pdf の HTML→PDF に外部データを差し込む際の
 * XSS / インジェクション対策に使う。
 * @packageDocumentation
 */
import sanitizeHtmlLib from "sanitize-html";

/**
 * 危険なタグ・属性を除去した安全な HTML を返す。
 * 既定では見出し・段落・強調・リンク・リスト・表など基本タグのみ許可する。
 *
 * @param dirty 信頼できない HTML
 * @returns サニタイズ済み HTML
 *
 * @example
 * ```ts
 * const safe = sanitize(userProvidedHtml);
 * const pdf = await pdfService.fromHtml(`<article>${safe}</article>`);
 * ```
 */
export function sanitize(dirty: string): string {
  return sanitizeHtmlLib(dirty, {
    allowedTags: [
      "h1", "h2", "h3", "h4", "p", "br", "hr", "strong", "em", "u", "s",
      "ul", "ol", "li", "blockquote", "a", "table", "thead", "tbody", "tr", "th", "td", "span", "div",
    ],
    allowedAttributes: { a: ["href", "title"], span: ["style"], div: ["style"] },
    allowedSchemes: ["http", "https", "mailto"],
    // style は限定的に許可(色・文字寄せ程度)
    allowedStyles: { "*": { "text-align": [/^left$|^right$|^center$/], color: [/^#[0-9a-fA-F]{3,6}$/] } },
  });
}

/**
 * プレーンテキスト化(全タグ除去)。ログや検索索引向け。
 *
 *
 * @param html 対象の HTML
 * @returns タグを除いた文字列。**これはサニタイズではない**(安全な HTML を作る用途には使えない)
 */
export function stripHtml(dirty: string): string {
  return sanitizeHtmlLib(dirty, { allowedTags: [], allowedAttributes: {} });
}
