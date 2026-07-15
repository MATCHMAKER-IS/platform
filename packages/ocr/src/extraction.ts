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

/** 日本語の日付文字列を ISO(YYYY-MM-DD)に変換する。西暦・和暦対応。 */
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

/** 合計金額を抽出する。合計系キーワード行を優先し、無ければ通貨記号付き最大額。 */
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

/** 適格請求書の登録番号(T+13桁)を探す。 */
export function findRegistrationNumber(text: string): string | null {
  const m = text.match(/T\s?(\d{13})\b/);
  return m ? `T${m[1]}` : null;
}

/** 電話番号を探す。 */
export function findPhone(text: string): string | null {
  const m = text.match(/(0\d{1,4}-\d{1,4}-\d{3,4})/);
  return m ? m[1]! : null;
}

/** OCR テキストから帳票フィールドをまとめて抽出する。 */
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

/** OCR 結果(text)配列から一括抽出する(純関数)。 */
export function extractReceiptsFromResults(results: { text: string }[]): ReceiptFields[] {
  return results.map((r) => extractReceiptFields(r.text));
}

/** OCR テキストを正規化する(全角数字/英字→半角・￥→¥・全角空白除去)。 */
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

/** 明細行(品名 + 金額)を抽出する。集計行は除外。 */
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

/** 請求書テキストからフィールドを抽出する(発行日/支払期限/小計/税/合計/登録番号)。 */
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

/** 複数税率(8%軽減 / 10%)の内訳を抽出する。「◯%対象」「消費税(◯%)」や、別行の「(内消費税 ¥…)」にも対応。 */
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

