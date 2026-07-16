/**
 * 改行・空白の正規化（全角/半角、連続空白、制御文字）。すべて純関数。
 * @packageDocumentation
 */

/**
 * 改行コードを LF に統一する。
 *
 * **Windows の `\r\n` が混ざると、行数がずれたり比較が一致しない**。
 * テキストを扱う前に通す。
 *
 * @param input 対象の文字列
 * @returns LF に統一した文字列
 */
export function normalizeNewlines(input: string): string {
  return input.replace(/\r\n?/g, "\n");
}

/**
 * 改行を `<br>` に変換する。
 *
 * **エスケープはしない**。ユーザー入力に使うなら、**先に {@link escapeHtml} を通す**こと
 * (順番を逆にすると `<br>` までエスケープされてしまう)。
 *
 * @param input 対象の文字列
 * @param options.xhtml `<br />` にするか(既定 false)
 * @returns 改行を `<br>` にした文字列
 */
export function nl2br(input: string, options: { xhtml?: boolean } = {}): string {
  const tag = options.xhtml ? "<br />" : "<br>";
  return normalizeNewlines(input).replace(/\n/g, `${tag}\n`);
}

/**
 * 全角スペースを半角スペースにする。
 *
 * **日本語入力では気づかないうちに全角スペースが混ざる**。検索や比較の前に通す。
 *
 * @param input 対象の文字列
 * @returns 変換した文字列
 */
export function zenkakuSpaceToHankaku(input: string): string {
  return input.replace(/\u3000/g, " ");
}

/**
 * 連続する空白を 1 個にまとめる。
 *
 * **改行は保持する**(段落の構造を壊さないため)。
 *
 * @param input 対象の文字列
 * @returns まとめた文字列
 */
export function collapseWhitespace(input: string): string {
  return input.replace(/[^\S\n]+/g, " ");
}

/**
 * 空白を正規化する: 全角スペース→半角、連続空白を 1 個に、前後の空白を除去。
 * フォーム入力のクレンジングに使う。
 *
 * @param input 対象の文字列
 * @returns 正規化した文字列
 */
export function normalizeSpace(input: string): string {
  return collapseWhitespace(zenkakuSpaceToHankaku(input)).trim();
}

/**
 * 表示に影響する制御文字を除去する(NULL・BOM など)。
 *
 * **外部から取り込んだテキストに混ざる**(CSV・OCR・古いシステムの出力)。
 * 見えないのに比較が一致しない、といった原因になる。**改行・タブは残す**。
 *
 * @param input 対象の文字列
 * @returns 制御文字を除いた文字列
 */
export function stripControlChars(input: string): string {
  // eslint-disable-next-line no-control-regex
  return input.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\uFEFF]/g, "");
}
