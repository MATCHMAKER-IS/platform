/**
 * 仕訳帳の CSV 書き出し（アプリ側の組み合わせ）。仕訳を会計ソフト取込用の CSV に変換する。
 * 行への変換は @platform/accounting、CSV 化は @platform/csv に委譲する。
 * @packageDocumentation
 */
import { journalToRows, type JournalEntry } from "@platform/accounting";
import { toCsv } from "@platform/csv";

/** 仕訳帳 CSV の列（日本語ヘッダ）。 */
const JOURNAL_COLUMNS = [
  { key: "date", header: "日付" },
  { key: "description", header: "摘要" },
  { key: "account", header: "勘定科目" },
  { key: "debit", header: "借方" },
  { key: "credit", header: "貸方" },
  { key: "memo", header: "備考" },
];

/** 仕訳を仕訳帳 CSV（Excel 互換・BOM 付き）に変換する。 */
export function journalCsv(entries: JournalEntry[]): string {
  const rows = journalToRows(entries) as unknown as Record<string, unknown>[];
  return toCsv(rows, { columns: JOURNAL_COLUMNS, bom: true });
}
