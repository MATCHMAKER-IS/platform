/**
 * 複式簿記の仕訳(純ロジック)。借方=貸方の均衡を保証し、試算表を集計する。
 * freee 等へは toFreeeDetails で振替伝票明細に変換して連携する。
 * @packageDocumentation
 */

/** 仕訳の 1 明細(勘定科目ごとの借方・貸方）。 */
export interface JournalLine {
  /** 勘定科目(例: "売掛金", "売上高", "仮受消費税"）。 */
  account: string;
  /** 借方金額。 */
  debit: number;
  /** 貸方金額。 */
  credit: number;
  /** 補助・備考。 */
  memo?: string;
  /** 部門(部門別集計に使う。任意)。 */
  department?: string;
}

/** 仕訳(1 伝票）。 */
export interface JournalEntry {
  /** 日付(ISO）。 */
  date: string;
  /** 摘要。 */
  description: string;
  lines: JournalLine[];
}

/** 借方合計。 */
export function debitTotal(entry: JournalEntry): number {
  return entry.lines.reduce((s, l) => s + l.debit, 0);
}

/** 貸方合計。 */
export function creditTotal(entry: JournalEntry): number {
  return entry.lines.reduce((s, l) => s + l.credit, 0);
}

/** 貸借が一致しているか(複式簿記の必須条件）。 */
export function isBalanced(entry: JournalEntry): boolean {
  return debitTotal(entry) === creditTotal(entry);
}

/** 勘定科目ごとの残高。 */
export interface AccountBalance {
  account: string;
  debit: number;
  credit: number;
  /** 借方 − 貸方(資産・費用は正、負債・収益は負になる想定）。 */
  balance: number;
}

/** 複数仕訳から試算表(勘定科目別の借方・貸方・残高）を作る。 */
export function trialBalance(entries: JournalEntry[]): AccountBalance[] {
  const map = new Map<string, { debit: number; credit: number }>();
  const order: string[] = [];
  for (const entry of entries) {
    for (const line of entry.lines) {
      if (!map.has(line.account)) {
        map.set(line.account, { debit: 0, credit: 0 });
        order.push(line.account);
      }
      const acc = map.get(line.account)!;
      acc.debit += line.debit;
      acc.credit += line.credit;
    }
  }
  return order.map((account) => {
    const a = map.get(account)!;
    return { account, debit: a.debit, credit: a.credit, balance: a.debit - a.credit };
  });
}

/** 試算表が全体で貸借一致しているか。 */
export function trialBalanceBalanced(entries: JournalEntry[]): boolean {
  const tb = trialBalance(entries);
  const debit = tb.reduce((s, a) => s + a.debit, 0);
  const credit = tb.reduce((s, a) => s + a.credit, 0);
  return debit === credit;
}

/** freee の振替伝票明細（entrySide + amount）へ変換する。 */
export function toFreeeDetails(entry: JournalEntry): { accountItem: string; entrySide: "debit" | "credit"; amount: number }[] {
  const details: { accountItem: string; entrySide: "debit" | "credit"; amount: number }[] = [];
  for (const line of entry.lines) {
    if (line.debit > 0) details.push({ accountItem: line.account, entrySide: "debit", amount: line.debit });
    if (line.credit > 0) details.push({ accountItem: line.account, entrySide: "credit", amount: line.credit });
  }
  return details;
}
