/**
 * 抽出フィールド(OCR結果など)から経費/支払記録を作り、印刷用 HTML を生成する。
 * OCR の帳票フィールド(金額・日付・登録番号)をそのまま流し込める。
 * @packageDocumentation
 */
import { calculateInvoice } from "./invoice.js";
import { formatYen } from "./money.js";

/** 抽出フィールドの入力(@platform/ocr の ReceiptFields と構造互換)。 */
export interface ExtractedFields {
  amount?: number;
  date?: string;
  registrationNumber?: string;
  phone?: string;
}

/** 経費/支払記録。 */
export interface ExpenseRecord {
  /** 税込金額。 */
  amount: number;
  date?: string;
  vendor?: string;
  registrationNumber?: string;
  /** 税率(%、既定 10)。 */
  taxRate?: number;
  /** 勘定科目・用途。 */
  category?: string;
  note?: string;
}

/**
 * 抽出したフィールドから経費記録を作る。
 *
 * **OCR や AI の抽出結果を受け取る**前提。読み取れなかった項目は `overrides` で補う。
 *
 * @param fields 抽出されたフィールド
 * @param overrides 上書きする値(人が直した分)
 * @returns 経費記録
 */
export function expenseFromReceiptFields(fields: ExtractedFields, overrides: Partial<ExpenseRecord> = {}): ExpenseRecord {
  return {
    amount: overrides.amount ?? fields.amount ?? 0,
    date: overrides.date ?? fields.date,
    registrationNumber: overrides.registrationNumber ?? fields.registrationNumber,
    vendor: overrides.vendor,
    taxRate: overrides.taxRate ?? 10,
    category: overrides.category,
    note: overrides.note,
  };
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

/**
 * 経費記録の税内訳を求める(税込から逆算)。
 *
 * **領収書には税込金額しか書かれていないことが多い**ため、そこから税抜と消費税を割り出す。
 * 計算は `@platform/tax` の `netFromGross` に委譲する。
 *
 * @param record 経費記録
 * @returns 税抜・消費税・税込
 * @param record 経費記録
 */
export function expenseTaxBreakdown(record: ExpenseRecord): { subtotal: number; tax: number; total: number; rate: number } {
  const rate = record.taxRate ?? 10;
  const calc = calculateInvoice({ lines: [{ description: "計", quantity: 1, unitPrice: record.amount, taxRate: rate }], taxMode: "inclusive" });
  return { subtotal: calc.subtotal, tax: calc.totalTax, total: calc.total, rate };
}

/**
 * 経費・支払記録の印刷用 HTML を生成する。
 *
 * @param record 経費記録
 * @returns 印刷用の HTML
 */
export function renderExpenseHtml(record: ExpenseRecord): string {
  const b = expenseTaxBreakdown(record);
  const row = (k: string, v: string) => `<tr><th>${esc(k)}</th><td>${v}</td></tr>`;
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>支払記録</title>
<style>
  body { font-family: "Hiragino Kaku Gothic ProN","Noto Sans JP",sans-serif; color:#0f172a; padding:24px; font-size:13px; }
  h1 { font-size:20px; letter-spacing:.2em; text-align:center; margin:0 0 16px; }
  table { border-collapse:collapse; width:100%; max-width:460px; }
  th,td { border:1px solid #cbd5e1; padding:8px 12px; text-align:left; }
  th { background:#f1f5f9; width:36%; }
  .total { font-size:16px; font-weight:700; }
</style></head><body>
  <h1>支 払 記 録</h1>
  <table>
    ${row("日付", esc(record.date ?? "—"))}
    ${row("支払先", esc(record.vendor ?? "—"))}
    ${row("登録番号", esc(record.registrationNumber ?? "—"))}
    ${row("科目", esc(record.category ?? "—"))}
    ${row("税抜金額", formatYen(b.subtotal))}
    ${row(`消費税(${b.rate}%)`, formatYen(b.tax))}
    <tr class="total"><th>税込合計</th><td>${formatYen(b.total)}</td></tr>
    ${record.note ? row("備考", esc(record.note)) : ""}
  </table>
</body></html>`;
}

/** 経費記録の DB 保存行(repository.create にそのまま渡せる)。 */
export interface ExpenseRow {
  amount: number;
  subtotal: number;
  tax: number;
  taxRate: number;
  date: Date | null;
  vendor: string | null;
  registrationNumber: string | null;
  category: string | null;
  note: string | null;
}

/**
 * 経費記録を DB 保存用の行に変換する。
 *
 * **税内訳をここで確定させる**(保存後に計算方法が変わっても、記録は当時のまま残る)。
 * 日付は文字列から Date に変換する。
 *
 * @param record 経費記録
 * @returns DB に保存できる形の行
 */
export function expenseToRow(record: ExpenseRecord): ExpenseRow {
  const b = expenseTaxBreakdown(record);
  return {
    amount: b.total,
    subtotal: b.subtotal,
    tax: b.tax,
    taxRate: b.rate,
    date: record.date ? new Date(record.date) : null,
    vendor: record.vendor ?? null,
    registrationNumber: record.registrationNumber ?? null,
    category: record.category ?? null,
    note: record.note ?? null,
  };
}
