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
/**
 * 埋め込みを許すドメイン。
 *
 * **任意のサイトを埋め込ませない。**
 * `<iframe>` の中は別のサイトで、こちらからは中身を見られない。
 * 偽のログイン画面を出す・広告を出す・利用者を追跡する、
 * いずれもこちらの責任として見える。
 *
 * 追加するときは、**なぜ必要か**を添えること。
 */
export const ALLOWED_EMBED_HOSTS = [
  "www.youtube.com", "youtube.com", "www.youtube-nocookie.com",  // 動画
  "player.vimeo.com",                                            // 動画
  "www.google.com", "maps.google.com",                           // 地図
  "docs.google.com",                                             // 資料・フォーム
  "www.slideshare.net",                                          // 資料
];

/**
 * ホスト名が許した先かを見る。
 *
 * **前方一致では判定しない。**
 * `youtube.com.evil.example` のような名前で抜けられる。
 *
 * @param src URL 文字列
 * @returns 許してよければ true
 */
function isAllowedEmbed(src: string): boolean {
  try {
    const u = new URL(src);
    // **http は許さない。** 埋め込み先が盗聴・改ざんされる
    if (u.protocol !== "https:") return false;
    return ALLOWED_EMBED_HOSTS.includes(u.hostname);
  } catch {
    // 相対パスや壊れた URL は埋め込みに使わない
    return false;
  }
}

/**
 * 埋め込み用に HTML を無害化する。
 *
 * **`sanitizeHtml` より許可を絞る。** 外部から来た HTML を
 * そのまま画面に出す用途なので、`iframe` や `script` は残さない。
 *
 * @param dirty 無害化する HTML
 * @returns 許可したタグ・属性だけが残った HTML
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
    transformTags: {
      /**
       * iframe を安全な形に整える。
       *
       * - **許した先でなければ落とす**(任意のサイトを埋め込ませない)
       * - **`sandbox` を必ず付ける**。中のスクリプトは動かすが、
       *   こちらのページを操作させない・勝手に画面遷移させない
       * - **`referrerpolicy`** で、どのページから来たかを渡さない
       */
      iframe: (_tagName, attribs) => {
        const src = attribs["src"] ?? "";
        if (!isAllowedEmbed(src)) {
          // **消さずに空の div にする。** 消すと本文の流れが崩れる
          return { tagName: "div", attribs: {}, text: "" };
        }
        return {
          tagName: "iframe",
          attribs: {
            ...attribs,
            // **`allow-same-origin` は付けない。**
            // 付けると埋め込み先がこちらの Cookie を読める
            sandbox: "allow-scripts allow-presentation",
            referrerpolicy: "no-referrer",
            // **読み込みを遅らせる。** 本文を開いた時点で
            // 埋め込み先に「読まれた」と伝わるのを避ける
            loading: "lazy",
          },
        };
      },
    },
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
