/**
 * テキスト→HTML 変換・切り詰め・リンク化。すべて純関数。
 * @packageDocumentation
 */
import { escapeHtml } from "./escape";
import { nl2br } from "./whitespace";

/**
 * プレーンテキストを安全な HTML にする: エスケープしてから改行を <br> に変換する。
 * ユーザー入力をそのまま表示したいときに使う（XSS 安全）。
 *
 * @param input プレーンテキスト
 * @returns 安全な HTML(**エスケープ → 改行変換の順**。逆にすると `<br>` までエスケープされる)
 */
export function textToHtml(input: string, options: { xhtml?: boolean } = {}): string {
  return nl2br(escapeHtml(input), options);
}

/**
 * 文字列を最大長で切り詰める。
 *
 * @param input 対象の文字列
 * @param maxLength 最大文字数(**suffix を含めた合計**)
 * @param suffix 省略記号(既定 `…`)
 * @returns 切り詰めた文字列。短ければそのまま
 */
export function truncate(input: string, max: number, suffix = "…"): string {
  if (max < 0 || input.length <= max) return input;
  if (suffix.length >= max) return input.slice(0, max);
  return input.slice(0, max - suffix.length) + suffix;
}

/**
 * 属性値をエスケープする。
 *
 * `escapeHtml` でもよいが、属性で危険なのは `"` と `<` と `&` なので、
 * `embed.ts` の `escapeAttribute` と同じ規則に揃えてある
 * (循環参照を避けるためここに置いている)。
 */
function escapeAttributeValue(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

const URL_RE = /https?:\/\/[^\s<>"']+/g;

/**
 * テキスト中の URL を <a> リンクにする。全体をエスケープしてから安全にリンク化する。
 * target/rel を指定可能（既定は別タブ + noopener noreferrer）。
 *
 * **`noopener` は必須**。付けないと、リンク先の JavaScript から元のページを操作できる
 * (タブナビング攻撃)。既定で付けてあるので、上書きするときは理由を確認すること。
 *
 * @param input プレーンテキスト
 * @param options.target 開き方(既定 `_blank`)
 * @param options.rel リンクの関係(既定 `noopener noreferrer`)
 * @param options.className リンクの CSS クラス
 * @returns リンク化した安全な HTML
 */
export function linkify(input: string, options: { target?: string; rel?: string; className?: string } = {}): string {
  // **3 つとも属性に入るので、3 つともエスケープする。**
  // 以前は className だけエスケープしており、target / rel は素通しだった。
  // 呼び出し側が値を組み立てていると、`_blank" onload="…` で任意の属性を差し込める。
  const target = escapeAttributeValue(options.target ?? "_blank");
  const rel = escapeAttributeValue(options.rel ?? "noopener noreferrer");
  const cls = options.className ? ` class="${escapeAttributeValue(options.className)}"` : "";
  // 先に全体をエスケープ（この時点で URL 内の & は &amp; になる）
  const escaped = escapeHtml(input);
  return escaped.replace(URL_RE, (url) => {
    // href 用に &amp; を & に戻して属性化（表示テキストはエスケープ済みのまま）
    const href = url.replace(/&amp;/g, "&");
    return `<a href="${href}" target="${target}" rel="${rel}"${cls}>${url}</a>`;
  });
}
