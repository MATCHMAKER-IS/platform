/**
 * HTML/スクリプト埋め込みタグの生成（計測タグ・iframe など）。属性はエスケープする。
 * embedHtml は「信頼済みの生 HTML」をそのまま通す用途（管理者が入力する計測タグ向け）。
 * @packageDocumentation
 */
import { escapeHtml } from "./escape.js";

/** 属性値をエスケープする（" と & と < を無害化）。 */
export function escapeAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function attrs(map: Record<string, string | boolean | number | undefined>): string {
  return Object.entries(map)
    .filter(([, v]) => v !== undefined && v !== false)
    .map(([k, v]) => (v === true ? ` ${k}` : ` ${k}="${escapeAttribute(String(v))}"`))
    .join("");
}

/** 外部スクリプトの埋め込みタグ（計測タグ等）。 */
export function embedScript(src: string, options: { async?: boolean; defer?: boolean; id?: string; crossorigin?: string } = {}): string {
  return `<script${attrs({ src, async: options.async, defer: options.defer, id: options.id, crossorigin: options.crossorigin })}></script>`;
}

/** インラインスクリプト（信頼済みコード。中身はそのまま出力）。 */
export function inlineScript(code: string, options: { id?: string } = {}): string {
  return `<script${attrs({ id: options.id })}>${code}</script>`;
}

/** iframe 埋め込み（YouTube・地図など）。 */
export function embedIframe(src: string, options: { width?: number | string; height?: number | string; title?: string; allow?: string; loading?: "lazy" | "eager"; allowfullscreen?: boolean } = {}): string {
  return `<iframe${attrs({ src, width: options.width, height: options.height, title: options.title, allow: options.allow, loading: options.loading ?? "lazy", allowfullscreen: options.allowfullscreen, frameborder: "0" })}></iframe>`;
}

/** noscript のトラッキングピクセル（img）。 */
export function trackingPixel(src: string, options: { width?: number; height?: number } = {}): string {
  return `<noscript><img src="${escapeAttribute(src)}"${attrs({ width: options.width ?? 1, height: options.height ?? 1, style: "display:none", alt: "" })}></noscript>`;
}

/**
 * 信頼済みの生 HTML をそのまま返す（管理者が入力した計測タグ等）。
 * ユーザー入力には使わないこと（XSS になる）。用途を明示するためのラッパー。
 */
export function embedHtml(trustedHtml: string): string {
  return trustedHtml;
}

/** 安全にプレーンテキストとして表示したい場合（比較用）。 */
export function embedAsText(html: string): string {
  return escapeHtml(html);
}
