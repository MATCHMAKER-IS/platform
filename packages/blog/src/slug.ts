/**
 * スラッグ(URL 用の識別子)生成。純ロジック。
 * 記事タイトルから URL に使える文字列を作る。日本語はそのままだと ASCII 化で消えるため、
 * allowUnicode で日本語スラッグを許すか、fallback(記事 ID 等)を使う。
 * @packageDocumentation
 */

/** スラッグ生成のオプション。 */
export interface SlugifyOptions {
  /** 日本語など非 ASCII の文字を残す(URL エンコードされる)。既定 false。 */
  allowUnicode?: boolean;
  /** 区切り文字(既定 "-")。 */
  separator?: string;
  /** 最大長(文字数)。 */
  maxLength?: number;
}

/**
 * タイトルからスラッグを生成する。
 *
 * **日本語は残らない**(URL に使える文字だけになる)。日本語タイトルでは
 * 空文字になるので、{@link slugFrom} を使うこと。
 *
 * @param input タイトル
 * @returns スラッグ。**日本語だけの入力では空文字になりうる**
 */
export function slugify(text: string, options: SlugifyOptions = {}): string {
  const sep = options.separator ?? "-";
  let s = text.trim().toLowerCase();
  if (options.allowUnicode) {
    // 文字・数字(全スクリプト)以外を区切りに
    s = s.replace(/[^\p{L}\p{N}]+/gu, sep);
  } else {
    // ASCII 英数字以外を区切りに(日本語は除去される)
    s = s.replace(/[^a-z0-9]+/g, sep);
  }
  // 連続する区切りをまとめ、前後の区切りを除去
  const sepEsc = sep.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  s = s.replace(new RegExp(`${sepEsc}{2,}`, "g"), sep).replace(new RegExp(`^${sepEsc}|${sepEsc}$`, "g"), "");
  if (options.maxLength && s.length > options.maxLength) {
    s = s.slice(0, options.maxLength).replace(new RegExp(`${sepEsc}$`), "");
  }
  return s;
}

/**
 * スラッグを生成し、**空になる場合は fallback を使う**。
 *
 * 日本語タイトルでも URL を作れるようにするため(実務ではこちらを使う)。
 *
 * @param input タイトル
 * @param fallback 空のときに使う値(記事 ID など)
 * @returns スラッグ
 */
export function ensureSlug(text: string, fallback: string, options?: SlugifyOptions): string {
  return slugify(text, options) || slugify(fallback, options) || fallback;
}

/**
 * 既存スラッグと衝突しないユニークなスラッグを返す(重複時は -2, -3... を付与)。
 * @param existing 既存のスラッグ集合
 * @returns 衝突しないスラッグ(`my-post` → `my-post-2`)
 */
export function uniqueSlug(base: string, existing: Iterable<string>, separator = "-"): string {
  const set = new Set(existing);
  if (!set.has(base)) return base;
  let n = 2;
  while (set.has(`${base}${separator}${n}`)) n++;
  return `${base}${separator}${n}`;
}
