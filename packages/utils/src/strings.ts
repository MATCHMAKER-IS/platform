/**
 * 文字列ユーティリティ(純関数)。切り詰め・全角半角変換・整形・ケース変換・マスクなど。
 * サロゲートペア(絵文字等)を壊さないよう `Array.from` ベースで数える。
 * @packageDocumentation
 */

// ───────────────────────── 切り詰め ─────────────────────────

/**
 * 文字数で切り詰め、末尾に省略記号を付ける。
 *
 * **日本語の画面幅を揃えたいなら {@link truncateByWidth} を使う**
 * (全角は半角の 2 倍の幅を取るため、文字数で切ると見た目が揃わない)。
 *
 * @param str 対象の文字列
 * @param maxLength 最大文字数(**省略記号を含めた合計**)
 * @param ellipsis 省略記号(既定 `…`)
 * @returns 切り詰めた文字列。短ければそのまま
 */
export function truncate(str: string, maxLength: number, ellipsis = "…"): string {
  const chars = Array.from(str);
  if (chars.length <= maxLength) return str;
  const ellLen = Array.from(ellipsis).length;
  const keep = Math.max(0, maxLength - ellLen);
  return chars.slice(0, keep).join("") + (keep > 0 || maxLength > 0 ? ellipsis : "");
}

/**
 * 中央を省略して先頭と末尾を残す。
 *
 * **ファイル名やパス向け**。末尾を切ると拡張子が消えて何のファイルか分からなくなる
 * (`report_2026_final.xlsx` → `report_2026_f…` では困る)。
 *
 * @param str 対象の文字列
 * @param maxLength 最大文字数
 * @param ellipsis 省略記号(既定 `…`)
 * @returns 中央を省略した文字列
 *
 * @example
 * ```ts
 * truncateMiddle("very_long_report_name.xlsx", 16);  // => "very_l…name.xlsx"
 * ```
 */
export function truncateMiddle(str: string, maxLength: number, ellipsis = "…"): string {
  const chars = Array.from(str);
  if (chars.length <= maxLength) return str;
  const ellLen = Array.from(ellipsis).length;
  const keep = Math.max(0, maxLength - ellLen);
  const head = Math.ceil(keep / 2);
  const tail = Math.floor(keep / 2);
  return chars.slice(0, head).join("") + ellipsis + (tail > 0 ? chars.slice(chars.length - tail).join("") : "");
}

/**
 * 単語数で切り詰める(空白区切り)。
 *
 * **英文向け**。日本語は空白で区切らないので、ほぼ 1 単語として扱われる
 * (日本語には {@link truncate} や {@link truncateByWidth} を使う)。
 *
 * @param str 対象の文字列
 * @param maxWords 最大単語数
 * @param ellipsis 省略記号(既定 `…`)
 * @returns 切り詰めた文字列
 */
export function truncateWords(str: string, maxWords: number, ellipsis = "…"): string {
  const words = str.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return str;
  return words.slice(0, maxWords).join(" ") + ellipsis;
}

/**
 * 表示幅で切り詰める(全角 = 2)。
 *
 * **日本語混じりの一覧で見た目を揃えたいときはこれ**。
 * 「あいう」(幅 6)と「abcdef」(幅 6)が同じ長さに見える。
 *
 * @param str 対象の文字列
 * @param maxWidth 最大の表示幅(**文字数ではない**)
 * @param ellipsis 省略記号(既定 `…`)
 * @returns 切り詰めた文字列
 */
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

/**
 * 表示幅を返す(全角・絵文字 = 2、半角 = 1)。
 *
 * 等幅フォントでの見た目の幅。**`str.length` とは違う**
 * (「あいう」は length 3 だが幅 6)。
 *
 * @param str 対象の文字列
 * @returns 表示幅
 */
export function textWidth(str: string): number {
  let w = 0;
  for (const ch of str) w += charWidth(ch.codePointAt(0) ?? 0);
  return w;
}

/**
 * 人が数える文字数を返す(サロゲートペアを 1 文字として数える)。
 *
 * **`str.length` は絵文字や一部の漢字を 2 と数える**(内部表現の単位のため)。
 * 「何文字入力したか」を人に見せるならこちらを使う。
 *
 * @param str 対象の文字列
 * @returns 文字数
 *
 * @example
 * ```ts
 * "𠮟".length;      // => 2(サロゲートペア)
 * charLength("𠮟"); // => 1(人が数える単位)
 * ```
 */
export function charLength(str: string): number {
  return Array.from(str).length;
}

// ─────────────────────── 全角/半角 ───────────────────────

/**
 * 全角の英数記号・空白を半角にする。
 *
 * **人が手入力した値を扱う前に通す**。日本語 IME は全角のまま英数字を打ってしまうため、
 * 「１２３」「ＡＢＣ」が混ざる。検索や照合の前に揃えておかないと一致しない。
 *
 * **カタカナは変換しない**(半角カナ→全角は {@link toFullWidthKana})。
 *
 * @param str 対象の文字列
 * @returns 半角にした文字列
 *
 * @example
 * ```ts
 * toHalfWidth("ＡＢＣ１２３");  // => "ABC123"
 * ```
 */
export function toHalfWidth(str: string): string {
  return str
    .replace(/[\uff01-\uff5e]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/\u3000/g, " ");
}

/**
 * 半角の英数記号・空白を全角にする。
 *
 * **使う場面は限られる**(帳票の見た目を揃える・全角必須の外部システムへ送る、など)。
 * 通常の入力正規化は逆向き({@link toHalfWidth})。
 *
 * @param str 対象の文字列
 * @returns 全角にした文字列
 */
export function toFullWidth(str: string): string {
  return str
    .replace(/[\u0021-\u007e]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0xfee0))
    .replace(/ /g, "\u3000");
}

/**
 * 全角数字だけを半角にする。
 *
 * **英字や記号は変えたくない**ときに使う(「Ａコース ３個」→「Ａコース 3個」)。
 * 全部半角にしてよいなら {@link toHalfWidth}。
 *
 * @param str 対象の文字列
 * @returns 数字だけ半角にした文字列
 */
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

/**
 * 半角カタカナを全角カタカナにする。
 *
 * **濁点・半濁点を合成する**(「ｶﾞ」の 2 文字 → 「ガ」の 1 文字)。
 * これをしないと文字数がずれ、検索も一致しない。
 *
 * 半角カナは古い基幹システムや FAX-OCR の出力に混ざる。取り込みの前に通す。
 *
 * @param str 対象の文字列
 * @returns 全角カタカナにした文字列
 *
 * @example
 * ```ts
 * toFullWidthKana("ｶﾞｯｺｳ");  // => "ガッコウ"
 * ```
 */
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

/**
 * よくある正規化をまとめて行う。
 *
 * 全角英数記号 → 半角、全角空白 → 半角、連続空白を 1 つに、前後の空白を除去。
 *
 * **人が入力した値は、検索・照合・保存の前にこれを通す**のが基本。
 * 「ＡＢＣ　 商事」と「ABC 商事」を同じものとして扱える。
 *
 * @param str 対象の文字列
 * @returns 正規化した文字列
 */
export function normalizeText(str: string): string {
  return normalizeSpace(toHalfWidth(str));
}

// ───────────────────────── 空白・改行 ─────────────────────────

/**
 * 連続する空白を 1 つにまとめ、前後を除去する。
 *
 * **全角空白も対象**。日本語入力では気づかないうちに全角空白が混ざる。
 *
 * @param str 対象の文字列
 * @returns 整えた文字列
 */
export function normalizeSpace(str: string): string {
  return str.replace(/\u3000/g, " ").replace(/[ \t\f\v]+/g, " ").replace(/ *\n */g, "\n").trim();
}

/**
 * 改行コードを `\n` に統一する。
 *
 * **Windows の `\r\n` が混ざると、行数がずれたり比較が一致しない**。
 * CSV 取り込みやテキスト比較の前に通す。
 *
 * @param str 対象の文字列
 * @returns `\n` に統一した文字列
 */
export function normalizeNewlines(str: string): string {
  return str.replace(/\r\n?/g, "\n");
}

/**
 * 空白だけかを判定する。
 *
 * **`null` / `undefined` / 空文字 / 全角空白のみ、をすべて「空」とみなす**。
 * 「入力されているか」の判定は `if (str)` では不十分(全角空白 1 つでも真になる)。
 *
 * @param str 対象の文字列(null / undefined も許す)
 * @returns 中身が無ければ true
 */
export function isBlank(str: string | null | undefined): boolean {
  return str == null || /^[\s\u3000]*$/.test(str);
}

/**
 * 行に分割する(改行コードを統一してから分割)。
 *
 * @param str 対象の文字列
 * @returns 行の配列。**`\r\n` が混ざっていても正しく分割される**
 */
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

/**
 * 先頭文字を大文字にする。
 *
 * @param str 対象の文字列
 * @returns 先頭を大文字にした文字列(**残りはそのまま**。`"aBC"` → `"ABC"` にはならない)
 */
export function capitalize(str: string): string {
  if (!str) return str;
  const chars = Array.from(str);
  return (chars[0] ?? "").toUpperCase() + chars.slice(1).join("");
}

/**
 * 各単語の先頭を大文字にする(空白区切り)。
 *
 * @param str 対象の文字列
 * @returns 単語ごとに先頭を大文字にした文字列
 */
export function capitalizeWords(str: string): string {
  return str.replace(/\S+/g, (w) => capitalize(w.toLowerCase()));
}

/**
 * camelCase にする。
 *
 * @param str 対象の文字列(スペース・ハイフン・アンダースコア区切りを解釈)
 * @returns camelCase の文字列
 *
 * @example
 * ```ts
 * camelCase("user name");   // => "userName"
 * camelCase("user-name");   // => "userName"
 * ```
 */
export function camelCase(str: string): string {
  const words = toWords(str);
  return words.map((w, i) => (i === 0 ? w.toLowerCase() : capitalize(w.toLowerCase()))).join("");
}

/**
 * PascalCase にする。
 *
 * @param str 対象の文字列
 * @returns PascalCase の文字列(型名・コンポーネント名に使う)
 */
export function pascalCase(str: string): string {
  return toWords(str).map((w) => capitalize(w.toLowerCase())).join("");
}

/**
 * kebab-case にする。
 *
 * @param str 対象の文字列
 * @returns kebab-case の文字列(URL・CSS クラス・ファイル名に使う)
 */
export function kebabCase(str: string): string {
  return toWords(str).map((w) => w.toLowerCase()).join("-");
}

/**
 * snake_case にする。
 *
 * @param str 対象の文字列
 * @returns snake_case の文字列(DB のカラム名などに使う)
 */
export function snakeCase(str: string): string {
  return toWords(str).map((w) => w.toLowerCase()).join("_");
}

/**
 * URL 向けの slug にする(ラテン文字・数字・ハイフンのみ)。
 *
 * **日本語は残らない**(「経費申請」→ 空文字)。日本語のタイトルから URL を作るなら、
 * ID を併記するか(`/posts/123-title`)、別途ローマ字変換が要る。
 *
 * @param str 対象の文字列
 * @returns slug。**日本語だけの入力では空文字になりうる**(呼び出し側で確認すること)
 *
 * @example
 * ```ts
 * slugify("Hello World!");  // => "hello-world"
 * slugify("経費申請");        // => ""(要注意)
 * ```
 */
export function slugify(str: string): string {
  return str
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ───────────────────────── 接頭・接尾 ─────────────────────────

/**
 * 接頭辞が無ければ付ける(あれば何もしない)。
 *
 * @param str 対象の文字列
 * @param prefix 付けたい接頭辞
 * @returns 接頭辞つきの文字列(**二重には付かない**)
 */
export function ensurePrefix(str: string, prefix: string): string {
  return str.startsWith(prefix) ? str : prefix + str;
}
/**
 * 接尾辞が無ければ付ける(あれば何もしない)。
 *
 * @param str 対象の文字列
 * @param suffix 付けたい接尾辞
 * @returns 接尾辞つきの文字列(**二重には付かない**)
 */
export function ensureSuffix(str: string, suffix: string): string {
  return str.endsWith(suffix) ? str : str + suffix;
}
/**
 * 接頭辞があれば外す(無ければ何もしない)。
 *
 * @param str 対象の文字列
 * @param prefix 外したい接頭辞
 * @returns 外した文字列
 */
export function removePrefix(str: string, prefix: string): string {
  return str.startsWith(prefix) ? str.slice(prefix.length) : str;
}
/**
 * 接尾辞があれば外す(無ければ何もしない)。
 *
 * @param str 対象の文字列
 * @param suffix 外したい接尾辞
 * @returns 外した文字列
 */
export function removeSuffix(str: string, suffix: string): string {
  return str.endsWith(suffix) ? str.slice(0, str.length - suffix.length) : str;
}

// ───────────────────────── HTML ─────────────────────────

/**
 * HTML タグを除去する。
 *
 * **これはサニタイズではない**。表示用に「タグを取ってプレーンテキストにする」だけ。
 * ユーザー入力を HTML として表示するなら {@link escapeHtml} を使うこと
 * (タグを除去しても `javascript:` の URL などは残る)。
 *
 * @param str 対象の文字列
 * @returns タグを除いた文字列
 */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "");
}

const HTML_ESCAPE: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
/**
 * HTML の特殊文字をエスケープする(`&<>"'`)。
 *
 * **ユーザー入力を HTML に埋め込むときは必ず通す**。これを忘れると XSS を許す
 * (`<script>` がそのまま実行される)。
 *
 * @param str 対象の文字列
 * @returns エスケープした文字列
 */
export function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (c) => HTML_ESCAPE[c] ?? c);
}
const HTML_UNESCAPE: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" };
/**
 * HTML エスケープを元に戻す。
 *
 * **表示直前には使わない**(エスケープを戻したものを HTML に入れると XSS になる)。
 * DB に保存されたエスケープ済みの値を、テキストとして扱いたいときに使う。
 *
 * @param str 対象の文字列
 * @returns 元に戻した文字列
 */
export function unescapeHtml(str: string): string {
  return str.replace(/&(amp|lt|gt|quot|#39);/g, (m) => HTML_UNESCAPE[m] ?? m);
}

// ───────────────────────── マスク(PII) ─────────────────────────

/**
 * 文字列の中央をマスクする。
 *
 * **ログや画面に個人情報をそのまま出さない**ため。全部隠すと本人確認ができないので、
 * 先頭と末尾だけ残す(「これは自分の情報だ」と分かる最小限)。
 *
 * @param str 対象の文字列
 * @param keepStart 先頭に残す文字数(既定 1)
 * @param keepEnd 末尾に残す文字数(既定 0)
 * @param maskChar マスク文字(既定 `*`)
 * @returns マスクした文字列。**残す文字数が元の長さ以上なら全マスク**(情報を漏らさない安全側)
 */
export function mask(str: string, options: { keepStart?: number; keepEnd?: number; maskChar?: string } = {}): string {
  const { keepStart = 1, keepEnd = 1, maskChar = "*" } = options;
  const chars = Array.from(str);
  if (chars.length <= keepStart + keepEnd) return maskChar.repeat(chars.length);
  const head = chars.slice(0, keepStart).join("");
  const tail = keepEnd > 0 ? chars.slice(chars.length - keepEnd).join("") : "";
  return head + maskChar.repeat(chars.length - keepStart - keepEnd) + tail;
}

/**
 * メールアドレスをマスクする(@ の前だけ隠す)。
 *
 * **ドメインは残す**(社内か社外かは分かった方が調査に役立つ)。
 *
 * @param email メールアドレス
 * @returns マスクしたアドレス。**@ が無ければ全体をマスク**(不正な形式でも漏らさない)
 *
 * @example
 * ```ts
 * maskEmail("yamada@example.com");  // => "y*****@example.com"
 * ```
 */
export function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return mask(email);
  const local = email.slice(0, at);
  const domain = email.slice(at);
  const maskedLocal = local.length <= 1 ? local : local[0] + "*".repeat(local.length - 1);
  return maskedLocal + domain;
}

// ───────────────────────── 桁揃え(全角考慮) ─────────────────────────

/**
 * 表示幅で右揃えにする(先頭を埋める)。
 *
 * **全角を 2 と数える**ので、日本語混じりの表でも桁が揃う。
 * `String.padStart` は文字数で数えるため、日本語では揃わない。
 *
 * @param str 対象の文字列
 * @param width 目標の表示幅
 * @param fill 埋める文字(既定は半角空白。**幅 1 の文字を渡すこと**)
 * @returns 埋めた文字列。**既に width 以上なら そのまま**(切り詰めはしない)
 */
export function padStartWidth(str: string, width: number, fill = " "): string {
  const w = textWidth(str);
  return w >= width ? str : fill.repeat(width - w) + str;
}

/**
 * 表示幅で左揃えにする(末尾を埋める)。
 *
 * **全角を 2 と数える**ので、日本語混じりの表でも桁が揃う。
 *
 * @param str 対象の文字列
 * @param width 目標の表示幅
 * @param fill 埋める文字(既定は半角空白。**幅 1 の文字を渡すこと**)
 * @returns 埋めた文字列。**既に width 以上なら そのまま**
 */
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

/**
 * 指定した表示幅で折り返す(全角 = 2)。
 *
 * 等幅フォントの帳票・コンソール出力向け。
 *
 * @param str 対象の文字列
 * @param width 1 行の表示幅
 * @returns 行の配列。**単語の途中でも折り返す**(日本語には単語境界が無いため)
 */
export function wrapText(str: string, width: number): string[] {
  if (width <= 0) return [str];
  return str.split(/\r?\n/).flatMap((l) => wrapLine(l, width));
}

// ───────────────────────── ハイライト ─────────────────────────

/** ハイライト用のセグメント。 */
export interface HighlightSegment { text: string; match: boolean }

/**
 * 検索語に一致する範囲を分割して返す(画面のハイライト用)。
 *
 * **HTML を組み立てずに配列で返す**。呼び出し側で `<mark>` を当てれば、
 * エスケープ漏れによる XSS を避けられる。
 *
 * @param str 対象の文字列
 * @param term 検索語(**大文字小文字は区別しない**)
 * @returns `{ text, matched }` の配列。term が空なら 1 要素(全体・matched: false)
 */
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

/**
 * 複数の検索語を一括でハイライトする。
 *
 * **重なる範囲は統合する**(「経費」と「費用」で「経費用」を検索したとき、
 * 二重にマークされないように)。
 *
 * @param str 対象の文字列
 * @param terms 検索語(空白区切りの文字列、または配列)
 * @returns `{ text, matched }` の配列
 */
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

/**
 * `{name}` 形式のテンプレートを置換する。
 *
 * メール文面・通知の文言に使う。
 *
 * @param template テンプレート文字列
 * @param params 置換する値
 * @param options.keepUnknown 未定義のキーを残すか(既定 true)。
 *   **既定で残すのは、置換漏れに気づけるようにするため**(空文字にすると文が壊れても分からない)
 * @returns 置換した文字列
 */
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

/**
 * ランダムな文字列を作る。
 *
 * **暗号用途には使わないこと**(`Math.random()` は予測可能)。
 * トークン・パスワード・OTP には `@platform/crypto` を使う。
 * これはテストデータやサンプル ID 向け。
 *
 * @param length 長さ
 * @param charset 使う文字(既定は英数字)
 * @returns ランダムな文字列
 */
export function randomString(length = 12, alphabet: string = ALNUM): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += alphabet[(bytes[i] ?? 0) % alphabet.length];
  return out;
}

/**
 * URL に使える短い ID を作る。
 *
 * **暗号用途には使わないこと**({@link randomString} と同じ理由)。
 * 画面の一時的なキーや、衝突しても困らない用途に。
 * DB の主キーには Prisma の `cuid()` を使う。
 *
 * @param size 長さ(既定 21)
 * @returns URL セーフな文字列(英数字・`-`・`_`)
 */
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
 *
 * @param text 対象の文字列
 * @param rules 置換ルール(from → to)
 * @param options.wholeWord 語境界でのみ置換するか(既定 false)。
 *   **日本語には効かない**(単語の区切りが無いため)
 * @returns 置換した文字列
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
 * 用語の一覧を「AI へのヒント文」に変換する。
 *
 * 固有名詞・社内用語を AI に伝えて、誤変換を減らす用途
 * (議事録の文字起こしで「経費精算」が「経費生産」になるのを防ぐ、など)。
 *
 * @param terms 用語の配列
 * @param options.intro 前置き(既定は「以下の用語に注意してください」相当)
 * @param options.separator 区切り(既定は読点)
 * @returns ヒント文。**用語が空なら空文字**(空のヒントを AI に渡さない)
 */
export function buildGlossaryHint(terms: string[], options: { intro?: string; separator?: string } = {}): string {
  if (terms.length === 0) return "";
  const intro = options.intro ?? "次の語は固有名詞・専門用語です: ";
  const sep = options.separator ?? " / ";
  return intro + terms.join(sep) + "。";
}

