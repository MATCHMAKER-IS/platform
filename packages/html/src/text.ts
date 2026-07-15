/**
 * テキスト→HTML 変換・切り詰め・リンク化。すべて純関数。
 * @packageDocumentation
 */
import { escapeHtml } from "./escape.js";
import { nl2br } from "./whitespace.js";

/**
 * プレーンテキストを安全な HTML にする: エスケープしてから改行を <br> に変換する。
 * ユーザー入力をそのまま表示したいときに使う（XSS 安全）。
 */
export function textToHtml(input: string, options: { xhtml?: boolean } = {}): string {
  return nl2br(escapeHtml(input), options);
}

/** 文字列を最大長に切り詰め、超過時は suffix を付ける（既定 "…"）。 */
export function truncate(input: string, max: number, suffix = "…"): string {
  if (max < 0 || input.length <= max) return input;
  if (suffix.length >= max) return input.slice(0, max);
  return input.slice(0, max - suffix.length) + suffix;
}

const URL_RE = /https?:\/\/[^\s<>"']+/g;

/**
 * テキスト中の URL を <a> リンクにする。全体をエスケープしてから安全にリンク化する。
 * target/rel を指定可能（既定は別タブ + noopener noreferrer）。
 */
export function linkify(input: string, options: { target?: string; rel?: string; className?: string } = {}): string {
  const target = options.target ?? "_blank";
  const rel = options.rel ?? "noopener noreferrer";
  const cls = options.className ? ` class="${escapeHtml(options.className)}"` : "";
  // 先に全体をエスケープ（この時点で URL 内の & は &amp; になる）
  const escaped = escapeHtml(input);
  return escaped.replace(URL_RE, (url) => {
    // href 用に &amp; を & に戻して属性化（表示テキストはエスケープ済みのまま）
    const href = url.replace(/&amp;/g, "&");
    return `<a href="${href}" target="${target}" rel="${rel}"${cls}>${url}</a>`;
  });
}
