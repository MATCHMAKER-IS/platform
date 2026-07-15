/**
 * 改行・空白の正規化（全角/半角、連続空白、制御文字）。すべて純関数。
 * @packageDocumentation
 */

/** 改行コードを LF(\n) に統一する（CRLF / CR → LF）。 */
export function normalizeNewlines(input: string): string {
  return input.replace(/\r\n?/g, "\n");
}

/** 改行を <br> に変換する（変換前に CRLF/CR を LF に統一）。xhtml=true で <br />。 */
export function nl2br(input: string, options: { xhtml?: boolean } = {}): string {
  const tag = options.xhtml ? "<br />" : "<br>";
  return normalizeNewlines(input).replace(/\n/g, `${tag}\n`);
}

/** 全角スペース(U+3000)を半角スペースに変換する。 */
export function zenkakuSpaceToHankaku(input: string): string {
  return input.replace(/\u3000/g, " ");
}

/** 連続する空白（スペース・タブ等）を 1 個のスペースにまとめる。改行は保持。 */
export function collapseWhitespace(input: string): string {
  return input.replace(/[^\S\n]+/g, " ");
}

/**
 * 空白を正規化する: 全角スペース→半角、連続空白を 1 個に、前後の空白を除去。
 * フォーム入力のクレンジングに使う。
 */
export function normalizeSpace(input: string): string {
  return collapseWhitespace(zenkakuSpaceToHankaku(input)).trim();
}

/** 表示に影響する制御文字（NULL や BOM など）を除去する。改行・タブは残す。 */
export function stripControlChars(input: string): string {
  // eslint-disable-next-line no-control-regex
  return input.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\uFEFF]/g, "");
}
