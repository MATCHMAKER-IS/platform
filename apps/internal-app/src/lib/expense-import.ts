/**
 * 経費 CSV 取込ロジック(純)。`@platform/csv` で解析し、日本語ヘッダを正規化、
 * `@platform/utils` の parseNumber で金額を数値化して Expense に変換する。
 * @packageDocumentation
 */
import { parseCsv } from "@platform/csv";
import { parseNumber } from "@platform/utils";
import type { Expense } from "./expense";

/** 取込フィールド定義(ImportReview / validateImportRows 用)。 */
export const EXPENSE_IMPORT_FIELDS = [
  { key: "date", label: "日付", type: "date" as const, required: true },
  { key: "category", label: "カテゴリ", type: "text" as const, required: true },
  { key: "amount", label: "金額", type: "number" as const, required: true },
  { key: "note", label: "備考", type: "text" as const },
];

const HEADER_ALIASES: Record<string, string> = {
  "日付": "date", "date": "date",
  "カテゴリ": "category", "勘定科目": "category", "category": "category",
  "金額": "amount", "amount": "amount",
  "備考": "note", "メモ": "note", "note": "note",
};

function canonicalKey(header: string): string {
  const trimmed = header.trim();
  return HEADER_ALIASES[trimmed] ?? HEADER_ALIASES[trimmed.toLowerCase()] ?? trimmed;
}

/** 日付を YYYY-MM-DD へ正規化(区切りは / . - を許容)。不正はそのまま返す。 */
export function normalizeDateStr(s: string): string {
  const m = s.trim().match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (!m) return s.trim();
  return `${m[1]}-${m[2]!.padStart(2, "0")}-${m[3]!.padStart(2, "0")}`;
}

/** CSV テキストを取込行(正規化済みキー)に変換する。 */
export function parseExpenseCsv(text: string): Record<string, string>[] {
  const parsed = parseCsv(text, { header: true }) as Record<string, string>[];
  return parsed.map((row) => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(row)) {
      const key = canonicalKey(k);
      out[key] = key === "date" ? normalizeDateStr(String(v)) : String(v).trim();
    }
    return out;
  });
}

/** 取込行を Expense[] へ変換する(金額は parseNumber)。 */
export function toExpenses(rows: Record<string, string>[]): Expense[] {
  return rows.map((r, i) => ({
    id: r.id?.trim() || `imp-${i + 1}`,
    date: normalizeDateStr(r.date ?? ""),
    category: (r.category ?? "").trim(),
    amount: parseNumber(r.amount ?? ""),
    note: (r.note ?? "").trim() || undefined,
  }));
}
