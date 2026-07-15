/**
 * 年次決算・繰越（アプリ側の組み合わせ）。期末に損益（収益・費用）を締めて当期純利益を
 * 繰越利益剰余金へ振り替える決算仕訳を作り、翌期首へ繰り越す残高を返す。集計は @platform/accounting に委譲。
 * @packageDocumentation
 */
import { trialBalance, defaultAccountTypes, type JournalEntry, type JournalLine, type AccountTypeMap } from "@platform/accounting";

/** 繰越利益剰余金の勘定科目名。 */
export const RETAINED_EARNINGS = "繰越利益剰余金";

/** 年次決算の結果。 */
export interface YearEndResult {
  year: number;
  /** 当期純利益（収益 − 費用）。 */
  netIncome: number;
  /** 損益を繰越利益剰余金へ振り替える決算仕訳（貸借一致）。 */
  closingEntry: JournalEntry;
  /** 翌期へ繰り越す繰越利益剰余金（期首繰越 ＋ 当期純利益）。 */
  retainedEarnings: number;
}

/**
 * 期末の損益を締めて繰越利益剰余金へ振り替える。
 * @param entries 当期の全仕訳。
 * @param year 会計年度。
 * @param priorRetained 期首の繰越利益剰余金（前期からの繰越）。
 * @param extraTypes 既定の勘定科目区分への追加（減価償却費など）。
 */
export function yearEndClosing(entries: JournalEntry[], year: number, priorRetained = 0, extraTypes: AccountTypeMap = {}): YearEndResult {
  const types: AccountTypeMap = { ...defaultAccountTypes(), ...extraTypes };
  const tb = trialBalance(entries);
  const lines: JournalLine[] = [];
  let revenue = 0;
  let expense = 0;
  for (const a of tb) {
    const t = types[a.account];
    if (t === "revenue") {
      const bal = a.credit - a.debit; // 収益は貸方残
      if (bal !== 0) { lines.push({ account: a.account, debit: bal, credit: 0, memo: "損益振替" }); revenue += bal; }
    } else if (t === "expense") {
      const bal = a.debit - a.credit; // 費用は借方残
      if (bal !== 0) { lines.push({ account: a.account, debit: 0, credit: bal, memo: "損益振替" }); expense += bal; }
    }
  }
  const netIncome = revenue - expense;
  // 差額を繰越利益剰余金へ（利益なら貸方、損失なら借方）
  lines.push({ account: RETAINED_EARNINGS, debit: netIncome < 0 ? -netIncome : 0, credit: netIncome > 0 ? netIncome : 0, memo: "当期純利益の繰越" });
  return {
    year,
    netIncome,
    closingEntry: { date: `${year}-12-31`, description: `決算振替（${year}年度）`, lines },
    retainedEarnings: priorRetained + netIncome,
  };
}
