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

/**
 * 借方(かりかた)の合計を求める。
 *
 * **借方は「資産の増加・費用の発生」**を表す(左側)。
 *
 * @param entry 仕訳
 * @returns 借方明細の合計金額
 */
export function debitTotal(entry: JournalEntry): number {
  return entry.lines.reduce((s, l) => s + l.debit, 0);
}

/**
 * 貸方(かしかた)の合計を求める。
 *
 * **貸方は「負債・純資産の増加・収益の発生」**を表す(右側)。
 *
 * @param entry 仕訳
 * @returns 貸方明細の合計金額
 */
export function creditTotal(entry: JournalEntry): number {
  return entry.lines.reduce((s, l) => s + l.credit, 0);
}

/**
 * 貸借が一致しているかを判定する。
 *
 * **複式簿記の必須条件**。借方と貸方が一致しない仕訳は、どこかが間違っている
 * (金額の打ち間違い・明細の入れ忘れ)。**保存する前に必ず確認する**。
 *
 * @param entry 仕訳
 * @returns 借方合計 === 貸方合計 なら true
 */
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

/**
 * 複数の仕訳から試算表を作る(勘定科目別の借方・貸方・残高)。
 *
 * 月次・年次の締めで「どの科目にいくら計上されたか」を一覧にする。
 *
 * @param entries 仕訳の配列
 * @returns 勘定科目ごとの借方合計・貸方合計・残高
 */
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

/**
 * 試算表が全体で貸借一致しているかを判定する。
 *
 * **個々の仕訳が正しくても、全体でずれることがある**(取り込み漏れなど)。
 * 締めの前にこれで確認する。
 *
 * @param entries 仕訳の配列
 * @returns 全体の借方合計 === 貸方合計 なら true
 */
export function trialBalanceBalanced(entries: JournalEntry[]): boolean {
  const tb = trialBalance(entries);
  const debit = tb.reduce((s, a) => s + a.debit, 0);
  const credit = tb.reduce((s, a) => s + a.credit, 0);
  return debit === credit;
}

/**
 * freee の振替伝票明細へ変換する。
 *
 * freee は借方・貸方を別の配列ではなく `entrySide` で区別するため、
 * その形に合わせる。
 *
 * @param entry 仕訳
 * @returns freee API に渡せる明細の配列
 */
export function toFreeeDetails(entry: JournalEntry): { accountItem: string; entrySide: "debit" | "credit"; amount: number }[] {
  const details: { accountItem: string; entrySide: "debit" | "credit"; amount: number }[] = [];
  for (const line of entry.lines) {
    if (line.debit > 0) details.push({ accountItem: line.account, entrySide: "debit", amount: line.debit });
    if (line.credit > 0) details.push({ accountItem: line.account, entrySide: "credit", amount: line.credit });
  }
  return details;
}
