/**
 * 請求書の金額計算(日本の消費税)。
 * - 税率別(10% 標準 / 8% 軽減 / 0% 非課税)に集計
 * - 外税(税抜単価)/ 内税(税込単価)に対応
 * - 端数処理は「税率ごとに1回」(適格請求書=インボイス制度のルール)
 * @packageDocumentation
 */
import { roundAmount, multiply, type RoundingMode } from "./money";

/** 明細行の入力。 */
export interface InvoiceLineInput {
  description: string;
  quantity: number;
  /** 単価(taxMode に応じて税抜/税込)。 */
  unitPrice: number;
  /** 税率(%)。既定 10。 */
  taxRate?: number;
  /** 単位(個・式など、任意)。 */
  unit?: string;
}

/** 計算オプション。 */
export interface InvoiceCalcOptions {
  /** 単価が税抜("exclusive"=外税、既定)か税込("inclusive"=内税)か。 */
  taxMode?: "exclusive" | "inclusive";
  /** 消費税の端数処理(既定 "round")。 */
  rounding?: RoundingMode;
}

/** 明細行の計算結果。 */
export interface InvoiceLine extends Required<Omit<InvoiceLineInput, "unit">> {
  unit?: string;
  /** 行の金額(taxMode に応じ税抜または税込)。 */
  amount: number;
}

/** 税率ごとの内訳。 */
export interface TaxBreakdown {
  /** 税率(%)。 */
  rate: number;
  /** 課税対象額(税抜)。 */
  taxableAmount: number;
  /** 消費税額。 */
  taxAmount: number;
}

/** 請求書の計算結果。 */
export interface InvoiceCalculation {
  lines: InvoiceLine[];
  /** 税率ごとの内訳(税率昇順)。 */
  taxBreakdown: TaxBreakdown[];
  /** 税抜合計。 */
  subtotal: number;
  /** 消費税合計。 */
  totalTax: number;
  /** 税込合計。 */
  total: number;
}

/**
 * 請求書の金額を計算する。
 * @example
 * ```ts
 * const calc = calculateInvoice({
 *   lines: [
 *     { description: "商品A", quantity: 3, unitPrice: 1000, taxRate: 10 },
 *     { description: "食品B", quantity: 2, unitPrice: 500, taxRate: 8 },
 *   ],
 * });
 * // calc.subtotal / calc.totalTax / calc.total / calc.taxBreakdown
 * ```
 *
 * @param input 明細と税率・端数処理の指定
 * @returns 小計・税額・合計と、**税率別の内訳**(適格請求書に必要な区分記載)
 */
export function calculateInvoice(
  input: { lines: InvoiceLineInput[] } & InvoiceCalcOptions,
): InvoiceCalculation {
  const taxMode = input.taxMode ?? "exclusive";
  const rounding = input.rounding ?? "round";

  const lines: InvoiceLine[] = input.lines.map((l) => ({
    description: l.description,
    quantity: l.quantity,
    unitPrice: l.unitPrice,
    taxRate: l.taxRate ?? 10,
    unit: l.unit,
    amount: multiply(l.quantity, l.unitPrice),
  }));

  // 税率ごとに合計
  const byRate = new Map<number, number>();
  for (const l of lines) byRate.set(l.taxRate, (byRate.get(l.taxRate) ?? 0) + l.amount);

  const taxBreakdown: TaxBreakdown[] = [];
  for (const [rate, sum] of [...byRate.entries()].sort((a, b) => a[0] - b[0])) {
    if (taxMode === "inclusive") {
      const taxable = roundAmount(sum / (1 + rate / 100), rounding); // 税抜
      taxBreakdown.push({ rate, taxableAmount: taxable, taxAmount: sum - taxable });
    } else {
      const tax = roundAmount(multiply(sum, rate / 100), rounding); // 税率ごとに1回端数処理
      taxBreakdown.push({ rate, taxableAmount: sum, taxAmount: tax });
    }
  }

  const subtotal = taxBreakdown.reduce((s, t) => s + t.taxableAmount, 0);
  const totalTax = taxBreakdown.reduce((s, t) => s + t.taxAmount, 0);
  return { lines, taxBreakdown, subtotal, totalTax, total: subtotal + totalTax };
}
