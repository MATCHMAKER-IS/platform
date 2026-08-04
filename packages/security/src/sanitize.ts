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
 * **埋め込み(iframe)を含む HTML** を安全化する。
 *
 * 動画・地図・フォームの埋め込みは `<iframe>` が要るため、{@link sanitize} では
 * 通らない(既定では iframe を除去する)。
 *
 * **「管理者が入れるものだから安全」とは考えない。**
 * 管理画面に入れる人が増えれば前提は崩れるし、
 * 乗っ取られた 1 アカウントで全ページに script を仕込まれる。
 *
 * 許すもの: `<iframe>` と、{@link sanitize} が許す基本タグ。
 * 許さないもの: `<script>` / `on*` 属性 / `javascript:` スキーム。
 *
 * @param dirty 埋め込みを含む HTML
 * @returns サニタイズ済み HTML
 *
 * @example
 * ```ts
 * // CMS の「埋め込み」ブロック
 * <div dangerouslySetInnerHTML={{ __html: sanitizeEmbed(block.html) }} />
 * ```
 */
export function sanitizeEmbed(dirty: string): string {
  return sanitizeHtmlLib(dirty, {
    allowedTags: [
      "h1", "h2", "h3", "h4", "p", "br", "hr", "strong", "em", "u", "s",
      "ul", "ol", "li", "blockquote", "a", "table", "thead", "tbody", "tr", "th", "td", "span", "div",
      // 埋め込み。**src のスキームは下で絞る**
      "iframe",
    ],
    allowedAttributes: {
      a: ["href", "title"],
      span: ["style"],
      div: ["style"],
      // iframe に許す属性。**on* は一切許さない**(sanitize-html の既定で除去される)
      iframe: ["src", "width", "height", "title", "allow", "loading", "allowfullscreen", "frameborder"],
    },
    // **http/https のみ。** `javascript:` や `data:` は通さない
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesAppliedToAttributes: ["href", "src"],
    allowedStyles: { "*": { "text-align": [/^left$|^right$|^center$/], color: [/^#[0-9a-fA-F]{3,6}$/] } },
  });
}

/**
 * プレーンテキスト化(全タグ除去)。ログや検索索引向け。
 *
 *
 * @param dirty 対象の HTML
 * @returns タグを除いた文字列。**これはサニタイズではない**(安全な HTML を作る用途には使えない)
 */
export function stripHtml(dirty: string): string {
  return sanitizeHtmlLib(dirty, { allowedTags: [], allowedAttributes: {} });
}
