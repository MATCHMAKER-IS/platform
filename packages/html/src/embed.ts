/**
 * HTML/スクリプト埋め込みタグの生成（計測タグ・iframe など）。属性はエスケープする。
 * embedHtml は「信頼済みの生 HTML」をそのまま通す用途（管理者が入力する計測タグ向け）。
 * @packageDocumentation
 */
import { escapeHtml } from "./escape";

/**
 * 属性値をエスケープする。
 *
 * **属性に入れる値は本文とは別のエスケープが要る**。`"` が閉じられると、
 * そこから新しい属性(`onerror=...`)を差し込まれる。
 *
 * @param value 属性値
 * @returns エスケープした文字列
 */
export function escapeAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function attrs(map: Record<string, string | boolean | number | undefined>): string {
  return Object.entries(map)
    .filter(([, v]) => v !== undefined && v !== false)
    .map(([k, v]) => (v === true ? ` ${k}` : ` ${k}="${escapeAttribute(String(v))}"`))
    .join("");
}

/**
 * 外部スクリプトの埋め込みタグを組み立てる(計測タグなど)。
 *
 * **URL は信頼できるものだけ**を渡すこと(ユーザー入力をそのまま渡すと任意の
 * スクリプトを実行される)。
 *
 * @param src スクリプトの URL
 * @param options.async / defer 読み込み方法
 * @returns `<script>` タグ
 */
export function embedScript(src: string, options: { async?: boolean; defer?: boolean; id?: string; crossorigin?: string } = {}): string {
  return `<script${attrs({ src, async: options.async, defer: options.defer, id: options.id, crossorigin: options.crossorigin })}></script>`;
}

/**
 * インラインスクリプトを組み立てる。
 *
 * **中身はそのまま出力する**(エスケープしない)。**信頼済みのコードだけ**を渡すこと。
 * ユーザー入力を混ぜると、そのまま実行される。
 *
 * @param code スクリプトの中身(**信頼済みであること**)
 * @returns `<script>` タグ
 */
export function inlineScript(code: string, options: { id?: string } = {}): string {
  return `<script${attrs({ id: options.id })}>${code}</script>`;
}

/**
 * iframe の埋め込みタグを組み立てる(YouTube・地図など)。
 *
 * **URL は信頼できるものだけ**。既定で `sandbox` を付けないので、
 * 埋め込む先を選ぶこと。
 *
 * @param src 埋め込む URL
 * @param options.width / height / title / allow 属性
 * @returns `<iframe>` タグ
 */
export function embedIframe(src: string, options: { width?: number | string; height?: number | string; title?: string; allow?: string; loading?: "lazy" | "eager"; allowfullscreen?: boolean } = {}): string {
  return `<iframe${attrs({ src, width: options.width, height: options.height, title: options.title, allow: options.allow, loading: options.loading ?? "lazy", allowfullscreen: options.allowfullscreen, frameborder: "0" })}></iframe>`;
}

/**
 * noscript 用のトラッキングピクセルを組み立てる。
 *
 * JavaScript が無効な環境でも計測するための `<img>`。
 *
 * @param src 画像の URL
 * @returns `<noscript>` で囲んだ `<img>` タグ
 */
export function trackingPixel(src: string, options: { width?: number; height?: number } = {}): string {
  return `<noscript><img src="${escapeAttribute(src)}"${attrs({ width: options.width ?? 1, height: options.height ?? 1, style: "display:none", alt: "" })}></noscript>`;
}

/**
 * 信頼済みの生 HTML をそのまま返す（管理者が入力した計測タグ等）。
 * ユーザー入力には使わないこと（XSS になる）。用途を明示するためのラッパー。
 *
 * @param html 生の HTML(**信頼済みであること**)
 * @returns そのままの HTML
 */
export function embedHtml(trustedHtml: string): string {
  return trustedHtml;
}

/**
 * プレーンテキストとして安全に表示する。
 *
 * **{@link embedInlineScript} と対比するための関数**。同じ文字列でも、
 * スクリプトとして出すか、テキストとして出すかで意味がまったく違う。
 *
 * @param text 表示するテキスト
 * @returns エスケープ済みの文字列
 */
export function embedAsText(html: string): string {
  return escapeHtml(html);
}
