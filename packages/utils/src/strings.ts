/**
 * 文字列ユーティリティ(純関数)。切り詰め・全角半角変換・整形・ケース変換・マスクなど。
 * サロゲートペア(絵文字等)を壊さないよう `Array.from` ベースで数える。
 * @packageDocumentation
 */

// ───────────────────────── 切り詰め ─────────────────────────

/** 文字数で切り詰め、末尾に ellipsis を付ける(合計が maxLength 以下)。 */
export function truncate(str: string, maxLength: number, ellipsis = "…"): string {
  const chars = Array.from(str);
  if (chars.length <= maxLength) return str;
  const ellLen = Array.from(ellipsis).length;
  const keep = Math.max(0, maxLength - ellLen);
  return chars.slice(0, keep).join("") + (keep > 0 || maxLength > 0 ? ellipsis : "");
}

/** 中央を省略して先頭と末尾を残す(ファイル名・パス向け)。 */
export function truncateMiddle(str: string, maxLength: number, ellipsis = "…"): string {
  const chars = Array.from(str);
  if (chars.length <= maxLength) return str;
  const ellLen = Array.from(ellipsis).length;
  const keep = Math.max(0, maxLength - ellLen);
  const head = Math.ceil(keep / 2);
  const tail = Math.floor(keep / 2);
  return chars.slice(0, head).join("") + ellipsis + (tail > 0 ? chars.slice(chars.length - tail).join("") : "");
}

/** 単語数で切り詰める(空白区切り)。 */
export function truncateWords(str: string, maxWords: number, ellipsis = "…"): string {
  const words = str.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return str;
  return words.slice(0, maxWords).join(" ") + ellipsis;
}

/** 表示幅(全角=2)で切り詰める。 */
export function truncateByWidth(str: string, maxWidth: number, ellipsis = "…"): string {
  if (textWidth(str) <= maxWidth) return str;
  const ellWidth = textWidth(ellipsis);
  let width = 0;
  let out = "";
  for (const ch of str) {
    const cw = charWidth(ch.codePointAt(0) ?? 0);
    if (width + cw > maxWidth - ellWidth) break;
    out += ch;
    width += cw;
  }
  return out + ellipsis;
}

// ───────────────────────── 表示幅 ─────────────────────────

function charWidth(cp: number): number {
  if (
    (cp >= 0x1100 && cp <= 0x115f) || // Hangul Jamo
    (cp >= 0x2e80 && cp <= 0xa4cf) || // CJK 部首〜漢字
    (cp >= 0xac00 && cp <= 0xd7a3) || // Hangul 音節
    (cp >= 0xf900 && cp <= 0xfaff) || // CJK 互換漢字
    (cp >= 0xfe30 && cp <= 0xfe4f) || // CJK 互換形
    (cp >= 0xff00 && cp <= 0xff60) || // 全角英数記号
    (cp >= 0xffe0 && cp <= 0xffe6) || // 全角記号
    (cp >= 0x1f300 && cp <= 0x1faff) || // 絵文字
    (cp >= 0x20000 && cp <= 0x3fffd) // CJK 拡張
  ) return 2;
  return 1;
}

/** 表示幅を返す(全角/絵文字=2、半角=1)。 */
export function textWidth(str: string): number {
  let w = 0;
  for (const ch of str) w += charWidth(ch.codePointAt(0) ?? 0);
  return w;
}

/** サロゲートペアを考慮した文字数。 */
export function charLength(str: string): number {
  return Array.from(str).length;
}

// ─────────────────────── 全角/半角 ───────────────────────

/** 全角の英数記号・空白を半角へ。 */
export function toHalfWidth(str: string): string {
  return str
    .replace(/[\uff01-\uff5e]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/\u3000/g, " ");
}

/** 半角の英数記号・空白を全角へ。 */
export function toFullWidth(str: string): string {
  return str
    .replace(/[\u0021-\u007e]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0xfee0))
    .replace(/ /g, "\u3000");
}

/** 全角数字のみ半角へ。 */
export function toHalfWidthDigits(str: string): string {
  return str.replace(/[\uff10-\uff19]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
}

const HANKAKU_KANA_BASE: Record<string, string> = {
  "｡": "。", "｢": "「", "｣": "」", "､": "、", "･": "・", "ｰ": "ー", "ﾞ": "゛", "ﾟ": "゜",
  "ｱ": "ア", "ｲ": "イ", "ｳ": "ウ", "ｴ": "エ", "ｵ": "オ", "ｶ": "カ", "ｷ": "キ", "ｸ": "ク", "ｹ": "ケ", "ｺ": "コ",
  "ｻ": "サ", "ｼ": "シ", "ｽ": "ス", "ｾ": "セ", "ｿ": "ソ", "ﾀ": "タ", "ﾁ": "チ", "ﾂ": "ツ", "ﾃ": "テ", "ﾄ": "ト",
  "ﾅ": "ナ", "ﾆ": "ニ", "ﾇ": "ヌ", "ﾈ": "ネ", "ﾉ": "ノ", "ﾊ": "ハ", "ﾋ": "ヒ", "ﾌ": "フ", "ﾍ": "ヘ", "ﾎ": "ホ",
  "ﾏ": "マ", "ﾐ": "ミ", "ﾑ": "ム", "ﾒ": "メ", "ﾓ": "モ", "ﾔ": "ヤ", "ﾕ": "ユ", "ﾖ": "ヨ",
  "ﾗ": "ラ", "ﾘ": "リ", "ﾙ": "ル", "ﾚ": "レ", "ﾛ": "ロ", "ﾜ": "ワ", "ｦ": "ヲ", "ﾝ": "ン",
  "ｧ": "ァ", "ｨ": "ィ", "ｩ": "ゥ", "ｪ": "ェ", "ｫ": "ォ", "ｬ": "ャ", "ｭ": "ュ", "ｮ": "ョ", "ｯ": "ッ",
};
const HANKAKU_KANA_VOICED: Record<string, string> = {
  "ｶ": "ガ", "ｷ": "ギ", "ｸ": "グ", "ｹ": "ゲ", "ｺ": "ゴ", "ｻ": "ザ", "ｼ": "ジ", "ｽ": "ズ", "ｾ": "ゼ", "ｿ": "ゾ",
  "ﾀ": "ダ", "ﾁ": "ヂ", "ﾂ": "ヅ", "ﾃ": "デ", "ﾄ": "ド", "ﾊ": "バ", "ﾋ": "ビ", "ﾌ": "ブ", "ﾍ": "ベ", "ﾎ": "ボ", "ｳ": "ヴ",
};
const HANKAKU_KANA_SEMIVOICED: Record<string, string> = {
  "ﾊ": "パ", "ﾋ": "ピ", "ﾌ": "プ", "ﾍ": "ペ", "ﾎ": "ポ",
};

/** 半角カタカナを全角カタカナへ(濁点・半濁点を合成)。 */
export function toFullWidthKana(str: string): string {
  let out = "";
  const chars = Array.from(str);
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]!;
    const next = chars[i + 1];
    if (next === "ﾞ" && HANKAKU_KANA_VOICED[ch]) { out += HANKAKU_KANA_VOICED[ch]; i++; continue; }
    if (next === "ﾟ" && HANKAKU_KANA_SEMIVOICED[ch]) { out += HANKAKU_KANA_SEMIVOICED[ch]; i++; continue; }
    out += HANKAKU_KANA_BASE[ch] ?? ch;
  }
  return out;
}

/** よくある正規化(全角英数記号→半角、全角空白→半角、連続空白を1つ、trim)。 */
export function normalizeText(str: string): string {
  return normalizeSpace(toHalfWidth(str));
}

// ───────────────────────── 空白・改行 ─────────────────────────

/** 連続する空白(全角含む)を1つにまとめ、前後を除去。 */
export function normalizeSpace(str: string): string {
  return str.replace(/\u3000/g, " ").replace(/[ \t\f\v]+/g, " ").replace(/ *\n */g, "\n").trim();
}

/** 改行を \n に統一。 */
export function normalizeNewlines(str: string): string {
  return str.replace(/\r\n?/g, "\n");
}

/** 空白のみ(全角含む)か。 */
export function isBlank(str: string | null | undefined): boolean {
  return str == null || /^[\s\u3000]*$/.test(str);
}

/** 行に分割(改行統一後)。 */
export function splitLines(str: string): string[] {
  return normalizeNewlines(str).split("\n");
}

// ───────────────────────── ケース変換 ─────────────────────────

function toWords(str: string): string[] {
  return str
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_\-.]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** 先頭文字を大文字に。 */
export function capitalize(str: string): string {
  if (!str) return str;
  const chars = Array.from(str);
  return (chars[0] ?? "").toUpperCase() + chars.slice(1).join("");
}

/** 各単語の先頭を大文字に。 */
export function capitalizeWords(str: string): string {
  return str.replace(/\S+/g, (w) => capitalize(w.toLowerCase()));
}

/** camelCase へ。 */
export function camelCase(str: string): string {
  const words = toWords(str);
  return words.map((w, i) => (i === 0 ? w.toLowerCase() : capitalize(w.toLowerCase()))).join("");
}

/** PascalCase へ。 */
export function pascalCase(str: string): string {
  return toWords(str).map((w) => capitalize(w.toLowerCase())).join("");
}

/** kebab-case へ。 */
export function kebabCase(str: string): string {
  return toWords(str).map((w) => w.toLowerCase()).join("-");
}

/** snake_case へ。 */
export function snakeCase(str: string): string {
  return toWords(str).map((w) => w.toLowerCase()).join("_");
}

/** URL 向けの slug へ(ラテン文字・数字・ハイフン)。 */
export function slugify(str: string): string {
  return str
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ───────────────────────── 接頭・接尾 ─────────────────────────

/** prefix が無ければ付ける。 */
export function ensurePrefix(str: string, prefix: string): string {
  return str.startsWith(prefix) ? str : prefix + str;
}
/** suffix が無ければ付ける。 */
export function ensureSuffix(str: string, suffix: string): string {
  return str.endsWith(suffix) ? str : str + suffix;
}
/** prefix があれば外す。 */
export function removePrefix(str: string, prefix: string): string {
  return str.startsWith(prefix) ? str.slice(prefix.length) : str;
}
/** suffix があれば外す。 */
export function removeSuffix(str: string, suffix: string): string {
  return str.endsWith(suffix) ? str.slice(0, str.length - suffix.length) : str;
}

// ───────────────────────── HTML ─────────────────────────

/** HTML タグを除去。 */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "");
}

const HTML_ESCAPE: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
/** HTML 特殊文字をエスケープ。 */
export function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (c) => HTML_ESCAPE[c] ?? c);
}
const HTML_UNESCAPE: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" };
/** HTML エスケープを戻す。 */
export function unescapeHtml(str: string): string {
  return str.replace(/&(amp|lt|gt|quot|#39);/g, (m) => HTML_UNESCAPE[m] ?? m);
}

// ───────────────────────── マスク(PII) ─────────────────────────

/** 文字列の中央をマスクする(先頭 keepStart・末尾 keepEnd を残す)。 */
export function mask(str: string, options: { keepStart?: number; keepEnd?: number; maskChar?: string } = {}): string {
  const { keepStart = 1, keepEnd = 1, maskChar = "*" } = options;
  const chars = Array.from(str);
  if (chars.length <= keepStart + keepEnd) return maskChar.repeat(chars.length);
  const head = chars.slice(0, keepStart).join("");
  const tail = keepEnd > 0 ? chars.slice(chars.length - keepEnd).join("") : "";
  return head + maskChar.repeat(chars.length - keepStart - keepEnd) + tail;
}

/** メールアドレスをマスク(ローカル部先頭のみ残す)。 */
export function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return mask(email);
  const local = email.slice(0, at);
  const domain = email.slice(at);
  const maskedLocal = local.length <= 1 ? local : local[0] + "*".repeat(local.length - 1);
  return maskedLocal + domain;
}

// ───────────────────────── 桁揃え(全角考慮) ─────────────────────────

/** 表示幅で左詰め(先頭を fill で埋めて width に)。fill は幅1想定。 */
export function padStartWidth(str: string, width: number, fill = " "): string {
  const w = textWidth(str);
  return w >= width ? str : fill.repeat(width - w) + str;
}

/** 表示幅で右詰め(末尾を fill で埋めて width に)。fill は幅1想定。 */
export function padEndWidth(str: string, width: number, fill = " "): string {
  const w = textWidth(str);
  return w >= width ? str : str + fill.repeat(width - w);
}

// ───────────────────────── 折り返し ─────────────────────────

function wrapLine(line: string, width: number): string[] {
  const out: string[] = [];
  let cur = "";
  let curW = 0;
  const tokens = line.match(/\s+|\S+/g) ?? [];
  const flush = () => { out.push(cur.replace(/[ \t]+$/, "")); cur = ""; curW = 0; };
  for (const tok of tokens) {
    const tokW = textWidth(tok);
    if (/^\s+$/.test(tok)) {
      if (curW > 0 && curW + tokW <= width) { cur += tok; curW += tokW; }
      continue; // 行頭/行末の空白は捨てる
    }
    if (curW + tokW <= width) { cur += tok; curW += tokW; continue; }
    if (curW > 0) flush();
    if (tokW <= width) { cur = tok; curW = tokW; continue; }
    // width を超える単語(URL や CJK 連続)は幅で強制分割
    for (const ch of tok) {
      const cw = charWidth(ch.codePointAt(0) ?? 0);
      if (curW + cw > width && curW > 0) flush();
      cur += ch;
      curW += cw;
    }
  }
  if (cur.length > 0 || out.length === 0) out.push(cur.replace(/[ \t]+$/, ""));
  return out;
}

/** 指定表示幅で折り返して行配列を返す(全角=2)。 */
export function wrapText(str: string, width: number): string[] {
  if (width <= 0) return [str];
  return str.split(/\r?\n/).flatMap((l) => wrapLine(l, width));
}

// ───────────────────────── ハイライト ─────────────────────────

/** ハイライト用のセグメント。 */
export interface HighlightSegment { text: string; match: boolean }

/** 検索語に一致する範囲を分割して返す(UI ハイライト用)。 */
export function highlight(text: string, query: string, options: { caseSensitive?: boolean } = {}): HighlightSegment[] {
  if (!query) return text ? [{ text, match: false }] : [];
  const hay = options.caseSensitive ? text : text.toLowerCase();
  const needle = options.caseSensitive ? query : query.toLowerCase();
  const segs: HighlightSegment[] = [];
  let i = 0;
  while (i < text.length) {
    const idx = hay.indexOf(needle, i);
    if (idx < 0) { segs.push({ text: text.slice(i), match: false }); break; }
    if (idx > i) segs.push({ text: text.slice(i, idx), match: false });
    segs.push({ text: text.slice(idx, idx + needle.length), match: true });
    i = idx + needle.length;
  }
  return segs.filter((s) => s.text.length > 0);
}

/** 複数語(空白区切り or 配列)を一括ハイライト。重なりは統合。 */
export function highlightTerms(text: string, terms: string | string[], options: { caseSensitive?: boolean } = {}): HighlightSegment[] {
  const list = (Array.isArray(terms) ? terms : terms.split(/\s+/)).filter(Boolean);
  if (list.length === 0) return text ? [{ text, match: false }] : [];
  const hay = options.caseSensitive ? text : text.toLowerCase();
  const ranges: Array<[number, number]> = [];
  for (const term of list) {
    const needle = options.caseSensitive ? term : term.toLowerCase();
    if (!needle) continue;
    let i = 0;
    while (true) {
      const idx = hay.indexOf(needle, i);
      if (idx < 0) break;
      ranges.push([idx, idx + needle.length]);
      i = idx + needle.length;
    }
  }
  if (ranges.length === 0) return text ? [{ text, match: false }] : [];
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([r[0], r[1]]);
  }
  const segs: HighlightSegment[] = [];
  let pos = 0;
  for (const [start, end] of merged) {
    if (start > pos) segs.push({ text: text.slice(pos, start), match: false });
    segs.push({ text: text.slice(start, end), match: true });
    pos = end;
  }
  if (pos < text.length) segs.push({ text: text.slice(pos), match: false });
  return segs.filter((x) => x.text.length > 0);
}

// ───────────────────────── テンプレート補間 ─────────────────────────

/** `{name}` を params で置換する。未定義キーは既定で残す。 */
export function parseTemplate(template: string, params: Record<string, string | number>, options: { keepMissing?: boolean } = {}): string {
  const keepMissing = options.keepMissing ?? true;
  return template.replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : keepMissing ? m : ""));
}

// ───────────────────────── ID 生成 ─────────────────────────

const ALNUM = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const URL_SAFE = ALNUM + "-_";

function randomBytes(n: number): Uint8Array {
  const arr = new Uint8Array(n);
  const g = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto;
  if (g?.getRandomValues) { g.getRandomValues(arr); return arr; }
  for (let i = 0; i < n; i++) arr[i] = Math.floor(Math.random() * 256);
  return arr;
}

/** ランダム文字列(既定は英数字)。暗号用途には使わないこと。 */
export function randomString(length = 12, alphabet: string = ALNUM): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += alphabet[(bytes[i] ?? 0) % alphabet.length];
  return out;
}

/** URL セーフな短い ID(既定 21 文字)。 */
export function nanoid(size = 21): string {
  return randomString(size, URL_SAFE);
}

/** 辞書エントリ(from を to に置換)。longest-match 優先で適用する。 */
export interface ReplacementRule {
  from: string;
  to: string;
}

/**
 * 辞書(from→to)でテキストを一括置換する。表記ゆれの統一や、音声認識・OCR の
 * 定型的な誤変換の補正に使う(出典: 社内 interview-transcribe の用語辞書置換を一般化)。
 *
 * - `from` が長いものから先に適用する(部分文字列の取りこぼしを防ぐ)。
 * - 既定は単純な文字列置換(正規表現ではない)。`wholeWord` 指定時は語境界でのみ置換。
 * - 空の `from` は無視する。
 *
 * @example
 * ```ts
 * replaceByDictionary("現地名で呼ぶ", [{ from: "現地名", to: "源氏名" }]); // "源氏名で呼ぶ"
 * ```
 */
export function replaceByDictionary(text: string, rules: ReplacementRule[], options: { wholeWord?: boolean } = {}): string {
  const sorted = rules.filter((r) => r.from).slice().sort((a, b) => b.from.length - a.from.length);
  let out = text;
  for (const { from, to } of sorted) {
    if (options.wholeWord) {
      const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      out = out.replace(new RegExp(`\\b${escaped}\\b`, "g"), to);
    } else {
      out = out.split(from).join(to);
    }
  }
  return out;
}

/**
 * 辞書を「用語ヒント文」に変換する(LLM へ固有名詞・専門用語を伝える用途)。
 * 出典: interview-transcribe の glossaryHint を一般化。辞書が空なら空文字。
 */
export function buildGlossaryHint(terms: string[], options: { intro?: string; separator?: string } = {}): string {
  if (terms.length === 0) return "";
  const intro = options.intro ?? "次の語は固有名詞・専門用語です: ";
  const sep = options.separator ?? " / ";
  return intro + terms.join(sep) + "。";
}

