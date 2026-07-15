/**
 * 勘定元帳（アプリ側の組み合わせ）。仕訳から特定の勘定科目の明細を日付順に抜き出し、残高を累計する。
 * 試算表からのドリルダウンに使う。純粋な組み立てのみ。
 * @packageDocumentation
 */
import { type JournalEntry } from "@platform/accounting";

/** 勘定元帳の 1 行（残高は借方 − 貸方の累計）。 */
export interface LedgerLine {
  date: string;
  description: string;
  debit: number;
  credit: number;
  /** 累計残高（借方残＝プラス）。 */
  balance: number;
  memo?: string;
}

/** ある勘定科目の元帳。 */
export interface AccountLedger {
  account: string;
  lines: LedgerLine[];
  debitTotal: number;
  creditTotal: number;
  /** 期末残高（借方 − 貸方）。 */
  closingBalance: number;
}

/** 仕訳から指定勘定科目の元帳を作る（日付昇順、同日は仕訳の登場順）。 */
export function accountLedger(entries: JournalEntry[], account: string): AccountLedger {
  const matched: { date: string; description: string; debit: number; credit: number; memo?: string; seq: number }[] = [];
  let seq = 0;
  for (const e of entries) {
    for (const l of e.lines) {
      if (l.account === account) matched.push({ date: e.date, description: e.description, debit: l.debit, credit: l.credit, ...(l.memo ? { memo: l.memo } : {}), seq: seq });
      seq += 1;
    }
  }
  matched.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.seq - b.seq));
  const lines: LedgerLine[] = [];
  let balance = 0;
  let debitTotal = 0;
  let creditTotal = 0;
  for (const m of matched) {
    balance += m.debit - m.credit;
    debitTotal += m.debit;
    creditTotal += m.credit;
    lines.push({ date: m.date, description: m.description, debit: m.debit, credit: m.credit, balance, ...(m.memo ? { memo: m.memo } : {}) });
  }
  return { account, lines, debitTotal, creditTotal, closingBalance: balance };
}
