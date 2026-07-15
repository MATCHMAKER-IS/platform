/**
 * HTML エスケープ／アンエスケープ、タグ除去。すべて純関数。
 * @packageDocumentation
 */

const ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** HTML 特殊文字をエスケープする（XSS 対策の基本）。 */
export function escapeHtml(input: string): string {
  return input.replace(/[&<>"']/g, (ch) => ESCAPE_MAP[ch]!);
}

const UNESCAPE_MAP: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&#x27;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
};

/** 主要な HTML エンティティを元に戻す。 */
export function unescapeHtml(input: string): string {
  return input.replace(/&(?:amp|lt|gt|quot|#39|#x27|apos|nbsp);/g, (ent) => UNESCAPE_MAP[ent] ?? ent);
}

/** HTML タグを取り除いてテキストだけにする。 */
export function stripTags(input: string): string {
  return input.replace(/<[^>]*>/g, "");
}
