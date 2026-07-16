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

/**
 * HTML の特殊文字をエスケープする(**XSS 対策の基本**)。
 *
 * **ユーザー入力を HTML に埋め込むときは必ず通す**。これを忘れると `<script>` が
 * そのまま実行される。React などのフレームワークは既定でエスケープするが、
 * `dangerouslySetInnerHTML` や文字列連結で HTML を組むときは自前で通す必要がある。
 *
 * @param input 対象の文字列
 * @returns エスケープした文字列(`&<>"'` を実体参照に)
 */
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

/**
 * HTML エンティティを元に戻す。
 *
 * **表示直前には使わない**(戻したものを HTML に入れると XSS になる)。
 * DB に保存されたエスケープ済みの値を、**テキストとして**扱いたいときだけ。
 *
 * @param input 対象の文字列
 * @returns 元に戻した文字列
 */
export function unescapeHtml(input: string): string {
  return input.replace(/&(?:amp|lt|gt|quot|#39|#x27|apos|nbsp);/g, (ent) => UNESCAPE_MAP[ent] ?? ent);
}

/**
 * HTML タグを取り除いてテキストだけにする。
 *
 * **これはサニタイズではない**。「タグを取ってプレーンテキストにする」だけで、
 * 安全な HTML を作る用途には使えない(ユーザー入力を HTML として表示するなら
 * {@link escapeHtml} を使う)。要約文や検索インデックスの生成に向く。
 *
 * @param input 対象の HTML
 * @returns タグを除いた文字列
 */
export function stripTags(input: string): string {
  return input.replace(/<[^>]*>/g, "");
}
