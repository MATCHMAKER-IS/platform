/**
 * 会計連携（アプリ側の組み合わせ）。請求・入金・仕入から仕訳と試算表を作る。
 * 仕訳ロジックは @platform/accounting に委譲する。
 * @packageDocumentation
 */
import { salesJournal, receiptJournal, purchaseJournal, journalToRows, trialBalance, isBalanced, type JournalEntry, type JournalRow, type AccountBalance } from "@platform/accounting";

/** 仕訳の元になる請求書。 */
export interface LedgerInvoice {
  number: string;
  issueDate: string;
  subtotal: number;
  tax: number;
  paidAmount: number;
  cancelled: boolean;
}

/** 仕訳の元になる発注。 */
export interface LedgerPurchase {
  number: string;
  orderDate: string;
  subtotal: number;
  tax: number;
  cancelled?: boolean;
}

/** 会計サマリー。 */
export interface LedgerSummary {
  entries: JournalEntry[];
  rows: JournalRow[];
  trialBalance: AccountBalance[];
  balanced: boolean;
}

/** 請求（売上）・入金・仕入から仕訳を起こし、試算表まで作る。 */
export function buildLedger(input: { invoices: LedgerInvoice[]; purchases: LedgerPurchase[] }): LedgerSummary {
  const entries: JournalEntry[] = [];
  for (const inv of input.invoices) {
    if (inv.cancelled) continue;
    entries.push(salesJournal({ date: inv.issueDate, description: `売上 ${inv.number}`, net: inv.subtotal, tax: inv.tax }));
    if (inv.paidAmount > 0) entries.push(receiptJournal({ date: inv.issueDate, description: `入金 ${inv.number}`, amount: inv.paidAmount }));
  }
  for (const po of input.purchases) {
    if (po.cancelled) continue;
    entries.push(purchaseJournal({ date: po.orderDate, description: `仕入 ${po.number}`, net: po.subtotal, tax: po.tax }));
  }
  entries.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return { entries, rows: journalToRows(entries), trialBalance: trialBalance(entries), balanced: entries.every(isBalanced) };
}
