/**
 * OCR テキストから帳票の項目(金額・日付・登録番号・電話)を抽出する(純関数)。
 * 領収書/レシートの自動入力に使う。和暦(令和/平成/昭和)にも対応。
 * @packageDocumentation
 */

/** 抽出した帳票フィールド。 */
export interface ReceiptFields {
  /** 合計金額(円)。 */
  amount?: number;
  /** 日付(ISO 8601 "YYYY-MM-DD")。 */
  date?: string;
  /** 適格請求書発行事業者の登録番号(T+13桁)。 */
  registrationNumber?: string;
  /** 電話番号。 */
  phone?: string;
}

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const eraBase: Record<string, number> = { "令和": 2018, "平成": 1988, "昭和": 1925, R: 2018, H: 1988, S: 1925 };

/**
 * 日本語の日付を ISO 形式にする(**西暦・和暦の両対応**)。
 *
 * 領収書には「令和8年7月15日」「2026/7/15」「26.7.15」など様々な形で書かれる。
 *
 * @param text 日付らしき文字列
 * @returns `YYYY-MM-DD`。**解釈できなければ null**
 */
export function parseJapaneseDate(text: string): string | null {
  // 和暦(漢字): 令和6年1月5日
  let m = text.match(/(令和|平成|昭和)\s*(元|\d{1,2})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (m) {
    const yr = m[2] === "元" ? 1 : Number(m[2]);
    return iso(eraBase[m[1]!]! + yr, Number(m[3]), Number(m[4]));
  }
  // 和暦(略記): R6.1.5 / H31-4-30
  m = text.match(/\b([RHS])\s*(\d{1,2})[./-](\d{1,2})[./-](\d{1,2})\b/i);
  if (m) return iso(eraBase[m[1]!.toUpperCase()]! + Number(m[2]), Number(m[3]), Number(m[4]));
  // 西暦: 2026年1月5日 / 2026/1/5 / 2026-01-05 / 2026.1.5
  m = text.match(/(\d{4})\s*[年/.-]\s*(\d{1,2})\s*[月/.-]\s*(\d{1,2})/);
  if (m) return iso(Number(m[1]), Number(m[2]), Number(m[3]));
  return null;
}

const AMOUNT_KEYWORD = /合計|総額|税込|お会計|ご請求|請求金額|お支払/;

/**
 * 合計金額を抽出する。
 *
 * **「合計」「お買上げ」などのキーワード行を優先**する。無ければ通貨記号付きの最大額
 * (レシートで最大の金額はたいてい合計だが、確実ではないので優先順位を付ける)。
 *
 * @param text OCR のテキスト
 * @returns 金額。**見つからなければ null**
 */
export function extractAmount(text: string): number | null {
  const lines = normalizeOcrText(text).split(/\r?\n/);
  const keywordAmounts: number[] = [];
  const markedAmounts: number[] = [];
  for (const line of lines) {
    const isKw = AMOUNT_KEYWORD.test(line);
    // ¥1,320 / 1,320円 / (キーワード行なら)1,320
    const re = /[¥￥]\s*([\d,]+)|([\d,]+)\s*円|(?:^|\s)([\d,]{2,})(?=\s|$)/g;
    let mm: RegExpExecArray | null;
    while ((mm = re.exec(line)) !== null) {
      const raw = mm[1] ?? mm[2] ?? mm[3];
      if (!raw) continue;
      const n = Number(raw.replace(/,/g, ""));
      if (!Number.isFinite(n) || n <= 0) continue;
      const marked = mm[1] != null || mm[2] != null; // 通貨記号/円あり
      if (isKw) keywordAmounts.push(n);
      else if (marked) markedAmounts.push(n);
    }
  }
  if (keywordAmounts.length) return Math.max(...keywordAmounts);
  if (markedAmounts.length) return Math.max(...markedAmounts);
  return null;
}

/**
 * 適格請求書の登録番号を探す(`T` + 13 桁)。
 *
 * **インボイス制度で必須**。これが無い領収書は仕入税額控除を受けられない。
 *
 * @param text OCR のテキスト
 * @returns 登録番号。**見つからなければ null**
 */
export function findRegistrationNumber(text: string): string | null {
  const m = text.match(/T\s?(\d{13})\b/);
  return m ? `T${m[1]}` : null;
}

/**
 * 電話番号を探す。
 *
 * @param text OCR のテキスト
 * @returns 電話番号。**見つからなければ null**
 */
export function findPhone(text: string): string | null {
  const m = text.match(/(0\d{1,4}-\d{1,4}-\d{3,4})/);
  return m ? m[1]! : null;
}

/**
 * OCR テキストから帳票のフィールドをまとめて抽出する。
 *
 * **抽出は当たらないことがある**(印字が薄い・手書き・レイアウト崩れ)。
 * 必ず人が確認できる画面を用意すること。
 *
 * @param text OCR のテキスト
 * @returns 日付・金額・登録番号・電話番号など(**取れなかった項目は undefined**)
 */
export function extractReceiptFields(text: string): ReceiptFields {
  const fields: ReceiptFields = {};
  const amount = extractAmount(text);
  const date = parseJapaneseDate(text);
  const reg = findRegistrationNumber(text);
  const phone = findPhone(text);
  if (amount != null) fields.amount = amount;
  if (date) fields.date = date;
  if (reg) fields.registrationNumber = reg;
  if (phone) fields.phone = phone;
  return fields;
}

/** 値つき・信頼度つきのフィールド。 */
export interface FieldWithConfidence<T> {
  value: T;
  /** 0〜100。OCR 単語の信頼度から算出。 */
  confidence: number;
}

/** 信頼度つきの抽出結果。 */
export interface ReceiptFieldsWithConfidence {
  amount?: FieldWithConfidence<number>;
  date?: FieldWithConfidence<string>;
  registrationNumber?: FieldWithConfidence<string>;
  phone?: FieldWithConfidence<string>;
}

/** OCR 単語(text/confidence)。 */
interface Wordish { text: string; confidence?: number }

/** token を含む単語の信頼度(複数該当は最小)。無ければ fallback。 */
function wordConfidence(words: Wordish[] | undefined, token: string, fallback: number): number {
  if (!words || token === "") return fallback;
  const norm = (s: string) => s.replace(/[\s,]/g, "");
  const t = norm(token);
  const hits = words.filter((w) => norm(w.text).includes(t) && w.confidence != null).map((w) => w.confidence!);
  return hits.length ? Math.min(...hits) : fallback;
}

/**
 * OCR 結果(テキスト + 単語)から、フィールドごとの信頼度つきで抽出する。
 * 各値に対応する単語の信頼度を割り当てる(見つからなければ overall を使用)。
 *
 * @param text OCR のテキスト
 * @returns 抽出結果と**確信度**(低いものは人の確認を促す。全部を信じさせない)
 */
export function extractReceiptFieldsWithConfidence(
  result: { text: string; confidence?: number; words?: Wordish[] },
): ReceiptFieldsWithConfidence {
  const base = extractReceiptFields(result.text);
  const overall = result.confidence ?? 0;
  const out: ReceiptFieldsWithConfidence = {};
  if (base.amount != null) out.amount = { value: base.amount, confidence: wordConfidence(result.words, String(base.amount), overall) };
  if (base.date) out.date = { value: base.date, confidence: wordConfidence(result.words, base.date.slice(0, 4), overall) };
  if (base.registrationNumber) out.registrationNumber = { value: base.registrationNumber, confidence: wordConfidence(result.words, base.registrationNumber, overall) };
  if (base.phone) out.phone = { value: base.phone, confidence: wordConfidence(result.words, base.phone, overall) };
  return out;
}

/** 1 枚の取り込み結果。 */
export interface ReceiptImportItem {
  index: number;
  ok: boolean;
  text?: string;
  fields?: ReceiptFields;
  error?: string;
}

/**
 * 複数の OCR 結果から一括抽出する。
 *
 * @param texts OCR のテキストの配列
 * @returns 各テキストの抽出結果
 */
export function extractReceiptsFromResults(results: { text: string }[]): ReceiptFields[] {
  return results.map((r) => extractReceiptFields(r.text));
}

/**
 * OCR テキストを正規化する。
 *
 * **OCR は全角と半角を混ぜて返す**(「￥1,234」と「¥1,234」)。
 * 抽出の前に揃えないと、金額を取りこぼす。
 *
 * @param text OCR の生テキスト
 * @returns 正規化したテキスト
 */
export function normalizeOcrText(text: string): string {
  return text
    .replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0))
    .replace(/[Ａ-Ｚａ-ｚ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/￥/g, "¥").replace(/，/g, ",").replace(/．/g, ".").replace(/：/g, ":")
    .replace(/　/g, " ").replace(/[ \t]+/g, " ");
}

/** 明細の 1 行。 */
export interface LineItem { name: string; amount: number }

const SUMMARY_KEYWORDS = /合計|小計|消費税|税込|税抜|お預|おつり|釣|現金|カード|クレジット|ポイント|登録番号|TEL|電話|印紙/;

/**
 * 明細行(品名 + 金額)を抽出する。
 *
 * **集計行は除外する**(「小計」「合計」「消費税」を明細に混ぜない)。
 * レシートの形式は多様なので、**常に取れるとは限らない**。
 *
 * @param text OCR のテキスト
 * @returns 明細行。**取れなければ空配列**
 */
export function extractLineItems(text: string): LineItem[] {
  const items: LineItem[] = [];
  for (const raw of normalizeOcrText(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || SUMMARY_KEYWORDS.test(line)) continue;
    const m = line.match(/^(.+?)\s*[¥]?\s*([\d,]+)\s*円?\s*$/);
    if (!m) continue;
    const name = m[1]!.trim();
    const amount = Number(m[2]!.replace(/,/g, ""));
    if (name && /\d/.test(m[2]!) && amount > 0 && !/^\d+$/.test(name)) items.push({ name, amount });
  }
  return items;
}

function amountNear(lines: string[], re: RegExp): number | null {
  for (const line of lines) {
    if (!re.test(line)) continue;
    // 通貨記号(¥/円)付きの数値を優先。無ければ行内の最大数値。
    const marked = [...line.matchAll(/[¥]\s*([\d,]+)|([\d,]+)\s*円/g)].map((x) => Number((x[1] ?? x[2])!.replace(/,/g, ""))).filter((n) => n > 0);
    if (marked.length) return Math.max(...marked);
    const any = [...line.matchAll(/([\d,]{2,})/g)].map((x) => Number(x[1]!.replace(/,/g, ""))).filter((n) => n > 0);
    if (any.length) return Math.max(...any);
  }
  return null;
}
function dateNear(lines: string[], re: RegExp): string | null {
  for (const line of lines) if (re.test(line)) { const d = parseJapaneseDate(line); if (d) return d; }
  return null;
}

/** 請求書のフィールド。 */
export interface InvoiceFields {
  invoiceNumber?: string;
  issueDate?: string;
  dueDate?: string;
  total?: number;
  subtotal?: number;
  tax?: number;
  registrationNumber?: string;
}

/**
 * 請求書からフィールドを抽出する。
 *
 * **適格請求書に必要な項目**(登録番号・税率別の内訳)を優先して探す。
 *
 * @param text OCR のテキスト
 * @returns 発行日・支払期限・小計・税・合計・登録番号(**取れなかった項目は undefined**)
 */
export function extractInvoiceFields(text: string): InvoiceFields {
  const norm = normalizeOcrText(text);
  const lines = norm.split(/\r?\n/);
  const fields: InvoiceFields = {};
  const no = norm.match(/(?:請求書?番号|Invoice\s*No\.?|No\.)\s*:?\s*([A-Za-z0-9-]+)/i);
  if (no) fields.invoiceNumber = no[1]!;
  const issue = dateNear(lines, /発行日|請求日|発行/);
  if (issue) fields.issueDate = issue;
  const due = dateNear(lines, /支払期限|お支払期限|支払期日|期日/);
  if (due) fields.dueDate = due;
  const total = amountNear(lines, /合計|ご請求金額|請求金額|お支払(?!期)/);
  if (total != null) fields.total = total;
  const sub = amountNear(lines, /小計/);
  if (sub != null) fields.subtotal = sub;
  const tax = amountNear(lines, /消費税|税額/);
  if (tax != null) fields.tax = tax;
  const reg = findRegistrationNumber(norm);
  if (reg) fields.registrationNumber = reg;
  return fields;
}

/** 税率ごとの内訳。 */
export interface TaxRateLine { rate: number; subtotal: number; tax?: number }

/**
 * 複数税率の内訳を抽出する(**軽減 8% と標準 10% の混在**に対応)。
 *
 * 「◯%対象」「消費税(◯%)」や、別行の「(内消費税 ¥…)」など、
 * **書き方が店ごとに違う**ので複数のパターンを試す。
 *
 * @param text OCR のテキスト
 * @returns 税率別の内訳。**取れなければ空配列**
 */
export function extractTaxBreakdown(text: string): TaxRateLine[] {
  const lines = normalizeOcrText(text).split(/\r?\n/);
  const map = new Map<number, { subtotal?: number; tax?: number }>();
  const order: number[] = [];
  let lastRate: number | null = null;
  for (const line of lines) {
    const rm = line.match(/(\d{1,2})\s*%/);
    const amounts = [...line.matchAll(/[¥]\s*([\d,]+)|([\d,]+)\s*円/g)].map((x) => Number((x[1] ?? x[2])!.replace(/,/g, ""))).filter((n) => n > 0);
    const isTaxLine = /消費税|税額|内税|外税|うち税/.test(line);
    const isBaseLine = /対象|税抜|小計|課税/.test(line);
    if (rm) {
      const rate = Number(rm[1]);
      if (rate !== 8 && rate !== 10) continue;
      lastRate = rate;
      if (!map.has(rate)) { map.set(rate, {}); order.push(rate); }
      const entry = map.get(rate)!;
      if (amounts.length) {
        if (isTaxLine && !isBaseLine) {
          entry.tax = amounts[amounts.length - 1];
        } else {
          entry.subtotal = Math.max(...amounts);
          if (isTaxLine && amounts.length > 1) entry.tax = amounts[amounts.length - 1];
        }
      }
    } else if (isTaxLine && amounts.length && lastRate != null) {
      // 税率トークンの無い税額行(例: "(内消費税 ¥80)")→ 直前の税率に紐づけ
      const entry = map.get(lastRate)!;
      if (entry.tax == null) entry.tax = amounts[amounts.length - 1];
    }
  }
  return order
    .map((rate) => ({ rate, subtotal: map.get(rate)!.subtotal ?? 0, tax: map.get(rate)!.tax }))
    .filter((l) => l.subtotal > 0 || l.tax != null)
    .sort((a, b) => a.rate - b.rate);
}

