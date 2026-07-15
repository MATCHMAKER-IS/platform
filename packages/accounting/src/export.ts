/**
 * 仕訳のエクスポート(純ロジック)。CSV 用のフラットな行や、freee の振替伝票明細へ変換する。
 * CSV 文字列化は @platform/csv、freee 送信は @platform/freee の buildManualJournal に渡す。
 * @packageDocumentation
 */
import { type JournalEntry } from "./journal.js";

/** CSV 1 行(仕訳明細を平坦化)。 */
export interface JournalRow {
  date: string;
  description: string;
  account: string;
  debit: number;
  credit: number;
  memo: string;
}

/** 仕訳群を CSV 用の行(明細ごと)に平坦化する。@platform/csv の toCsv に渡す。 */
export function journalToRows(entries: JournalEntry[]): JournalRow[] {
  return entries.flatMap((e) =>
    e.lines.map((l) => ({
      date: e.date,
      description: e.description,
      account: l.account,
      debit: l.debit,
      credit: l.credit,
      memo: l.memo ?? "",
    })),
  );
}

/** freee 振替伝票の明細。 */
export interface FreeeJournalDetail {
  entrySide: "debit" | "credit";
  accountItemId: number;
  amount: number;
}

/**
 * 仕訳を freee の振替伝票明細に変換する。勘定科目名 → freee 勘定科目 ID の対応表が必要。
 * 未登録の科目があれば unknownAccounts に集める(送信前チェック用)。
 */
export function journalToFreeeDetails(
  entry: JournalEntry,
  accountItemIds: Record<string, number>,
): { details: FreeeJournalDetail[]; unknownAccounts: string[] } {
  const details: FreeeJournalDetail[] = [];
  const unknown = new Set<string>();
  for (const line of entry.lines) {
    const id = accountItemIds[line.account];
    if (id === undefined) {
      unknown.add(line.account);
      continue;
    }
    if (line.debit > 0) details.push({ entrySide: "debit", accountItemId: id, amount: line.debit });
    if (line.credit > 0) details.push({ entrySide: "credit", accountItemId: id, amount: line.credit });
  }
  return { details, unknownAccounts: [...unknown] };
}
