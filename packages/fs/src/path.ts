/**
 * パス・ファイル名ユーティリティ(純)。`node:path` を土台に、ファイル名の無害化・
 * 拡張子操作・パストラバーサル判定・MIME 推定などを追加する。
 * @packageDocumentation
 */
import * as nodePath from "node:path";

/** パスを結合する(`path.join`)。 */
export function joinPath(...parts: string[]): string { return nodePath.join(...parts); }
/** 絶対パスへ解決する(`path.resolve`)。 */
export function resolvePath(...parts: string[]): string { return nodePath.resolve(...parts); }
/** パスを正規化する(`..` などを畳む)。 */
export function normalizePath(p: string): string { return nodePath.normalize(p); }
/** 親ディレクトリ。 */
export function dirname(p: string): string { return nodePath.dirname(p); }
/** ファイル名部分(拡張子を除く場合は ext を渡す)。 */
export function basename(p: string, ext?: string): string { return nodePath.basename(p, ext); }
/** 拡張子(先頭のドット込み。無ければ "")。 */
export function extname(p: string): string { return nodePath.extname(p); }

/** 拡張子なしのフルパス。 */
export function withoutExt(p: string): string {
  const ext = nodePath.extname(p);
  return ext ? p.slice(0, -ext.length) : p;
}

/** ファイル名を {name, ext} に分解(ext はドット無し)。 */
export function splitExt(filename: string): { name: string; ext: string } {
  const ext = nodePath.extname(filename);
  return { name: ext ? filename.slice(0, -ext.length) : filename, ext: ext.replace(/^\./, "") };
}

/** 拡張子を差し替える(newExt はドット有無どちらでも可)。 */
export function changeExt(p: string, newExt: string): string {
  const dot = newExt === "" ? "" : newExt.startsWith(".") ? newExt : `.${newExt}`;
  return withoutExt(p) + dot;
}

const ILLEGAL = /[<>:"/\\|?*\u0000-\u001f]/g;
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

/** ファイル名を安全化する(禁止文字を置換・前後空白/ドット除去・長さ制限・予約名回避)。 */
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

/** 既存名と衝突しない一意なファイル名を作る(例: report.csv → report (1).csv)。 */
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

/** child が parent の配下(サブパス)か。パストラバーサル対策に使う。 */
export function isSubPath(parent: string, child: string): boolean {
  const rel = nodePath.relative(nodePath.resolve(parent), nodePath.resolve(child));
  return rel !== "" && !rel.startsWith("..") && !nodePath.isAbsolute(rel);
}

/** parent から child への相対パス。 */
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

/** 拡張子から MIME タイプを推定する(不明なら application/octet-stream)。 */
export function guessMimeType(filename: string): string {
  return MIME[splitExt(filename).ext.toLowerCase()] ?? "application/octet-stream";
}
