/**
 * パス・ファイル名ユーティリティ(純)。`node:path` を土台に、ファイル名の無害化・
 * 拡張子操作・パストラバーサル判定・MIME 推定などを追加する。
 * @packageDocumentation
 */
import * as nodePath from "node:path";

/**
 * パスを結合する。
 *
 * @param segments 結合するパス
 * @returns 結合したパス(`..` は畳まれる)
 */
export function joinPath(...parts: string[]): string { return nodePath.join(...parts); }
/**
 * 絶対パスへ解決する。
 *
 * @param segments 解決するパス
 * @returns 絶対パス(**カレントディレクトリ基準**なので、実行場所によって変わる)
 */
export function resolvePath(...parts: string[]): string { return nodePath.resolve(...parts); }
/**
 * パスを正規化する(`..` や `.` を畳む)。
 *
 * @param p パス
 * @returns 正規化したパス
 */
export function normalizePath(p: string): string { return nodePath.normalize(p); }
/**
 * 親ディレクトリを返す。
 *
 * @param p パス
 * @returns 親ディレクトリのパス
 */
export function dirname(p: string): string { return nodePath.dirname(p); }
/**
 * ファイル名の部分を返す。
 *
 * @param p パス
 * @param ext 除きたい拡張子(渡すとその分を落とす)
 * @returns ファイル名
 */
export function basename(p: string, ext?: string): string { return nodePath.basename(p, ext); }
/**
 * 拡張子を返す。
 *
 * @param p パス
 * @returns 拡張子(**先頭のドット込み**。無ければ空文字)
 */
export function extname(p: string): string { return nodePath.extname(p); }

/**
 * 拡張子を除いたフルパスを返す。
 *
 * @param p パス
 * @returns 拡張子なしのパス
 */
export function withoutExt(p: string): string {
  const ext = nodePath.extname(p);
  return ext ? p.slice(0, -ext.length) : p;
}

/**
 * ファイル名を名前と拡張子に分解する。
 *
 * @param p パス
 * @returns `{ name, ext }`(**ext はドット無し**。`extname` とは違うので注意)
 */
export function splitExt(filename: string): { name: string; ext: string } {
  const ext = nodePath.extname(filename);
  return { name: ext ? filename.slice(0, -ext.length) : filename, ext: ext.replace(/^\./, "") };
}

/**
 * 拡張子を差し替える。
 *
 * @param p パス
 * @param newExt 新しい拡張子(**ドット有無どちらでも可**)
 * @returns 差し替えたパス
 */
export function changeExt(p: string, newExt: string): string {
  const dot = newExt === "" ? "" : newExt.startsWith(".") ? newExt : `.${newExt}`;
  return withoutExt(p) + dot;
}

const ILLEGAL = /[<>:"/\\|?*\u0000-\u001f]/g;
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

/**
 * ファイル名を安全化する。
 *
 * **利用者が付けた名前をそのままファイル名にしない**。禁止文字(`/` `\` `:` など)、
 * 前後の空白・ドット、Windows の予約名(`CON` `PRN` など)を処理する。
 * これを怠ると、保存に失敗するか、**意図しない場所に書き込まれる**。
 *
 * @param name 元のファイル名
 * @param options.maxLength 最大長(既定 255)
 * @param options.replacement 禁止文字の置換先(既定 `_`)
 * @returns 安全なファイル名
 */
export function sanitizeFilename(name: string, options: { replacement?: string; maxLength?: number } = {}): string {
  const replacement = options.replacement ?? "_";
  const maxLength = options.maxLength ?? 255;
  let out = name.replace(ILLEGAL, replacement).replace(/\s+/g, " ").trim().replace(/^\.+/, "").replace(/[. ]+$/, "");
  if (out === "") out = "untitled";
  const { name: base, ext } = splitExt(out);
  if (RESERVED.test(base)) out = `_${out}`;
  if (out.length > maxLength) {
    const keepExt = ext ? `.${ext}` : "";
    out = out.slice(0, maxLength - keepExt.length) + keepExt;
  }
  return out;
}

/**
 * 既存の名前と衝突しない一意なファイル名を作る。
 *
 * **上書きせずに保存する**ため(`report.csv` → `report (1).csv`)。
 *
 * @param name 希望する名前
 * @param existing 既にある名前
 * @returns 衝突しない名前
 */
export function uniqueFilename(name: string, existing: Iterable<string>): string {
  const set = new Set(existing);
  if (!set.has(name)) return name;
  const { name: base, ext } = splitExt(name);
  const suffix = ext ? `.${ext}` : "";
  for (let i = 1; ; i++) {
    const candidate = `${base} (${i})${suffix}`;
    if (!set.has(candidate)) return candidate;
  }
}

/**
 * child が parent の配下にあるかを判定する。
 *
 * **パストラバーサル対策の要**。利用者が指定したパスを使う前に必ず通す。
 * `../../etc/passwd` のような指定で、**想定外の場所を読み書きされる**のを防ぐ。
 *
 * @param parent 親ディレクトリ
 * @param child 判定するパス
 * @returns 配下なら true。**同じパスなら false**(自分自身は「配下」ではない)
 */
export function isSubPath(parent: string, child: string): boolean {
  const rel = nodePath.relative(nodePath.resolve(parent), nodePath.resolve(child));
  return rel !== "" && !rel.startsWith("..") && !nodePath.isAbsolute(rel);
}

/**
 * parent から child への相対パスを返す。
 *
 * @param parent 基準のパス
 * @param child 対象のパス
 * @returns 相対パス
 */
export function relativePath(from: string, to: string): string { return nodePath.relative(from, to); }

const MIME: Record<string, string> = {
  txt: "text/plain", csv: "text/csv", json: "application/json", xml: "application/xml",
  html: "text/html", htm: "text/html", css: "text/css", js: "text/javascript", md: "text/markdown",
  pdf: "application/pdf", zip: "application/zip", gz: "application/gzip",
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

/**
 * 拡張子から MIME タイプを推定する。
 *
 * **これは推定であって検証ではない**。アップロードの検証には、
 * 中身を見る {@link detectFileType} を使うこと(拡張子は偽装できる)。
 *
 * @param p パス
 * @returns MIME タイプ。**不明なら `application/octet-stream`**
 */
export function guessMimeType(filename: string): string {
  return MIME[splitExt(filename).ext.toLowerCase()] ?? "application/octet-stream";
}
