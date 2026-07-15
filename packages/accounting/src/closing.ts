/**
 * 月次決算(純ロジック)。仕訳から損益計算(P/L)と貸借の集計を行う。
 * 勘定科目の区分(資産/負債/純資産/収益/費用)に基づく。
 * @packageDocumentation
 */
import { type JournalEntry, trialBalance } from "./journal.js";
import { DEFAULT_ACCOUNTS, type AccountNames } from "./entries.js";

/** 勘定科目の区分。 */
export type AccountType = "asset" | "liability" | "equity" | "revenue" | "expense";

/** 勘定科目 → 区分の対応。 */
export type AccountTypeMap = Record<string, AccountType>;

/** 既定の勘定科目区分(DEFAULT_ACCOUNTS に対応)。 */
export function defaultAccountTypes(accounts: AccountNames = DEFAULT_ACCOUNTS): AccountTypeMap {
  return {
    [accounts.receivable]: "asset",
    [accounts.cash]: "asset",
    [accounts.inputTax]: "asset",
    [accounts.payable]: "liability",
    [accounts.outputTax]: "liability",
    [accounts.sales]: "revenue",
    [accounts.purchase]: "expense",
    [accounts.expense]: "expense",
    [accounts.unpaid]: "liability",
    [accounts.advance]: "asset",
    [accounts.salary]: "expense",
    [accounts.withholdingPayable]: "liability",
    [accounts.socialPayable]: "liability",
  };
}

/** 指定年月(YYYY-MM)の仕訳だけ抽出する。 */
export function filterByPeriod(entries: JournalEntry[], yearMonth: string): JournalEntry[] {
  return entries.filter((e) => e.date.slice(0, 7) === yearMonth);
}

/** 損益計算の結果。 */
export interface ProfitAndLoss {
  revenue: number;
  expense: number;
  /** 当期純利益(収益 − 費用)。 */
  netIncome: number;
}

/** 仕訳から損益(収益・費用・純利益)を集計する。 */
export function profitAndLoss(entries: JournalEntry[], types: AccountTypeMap = defaultAccountTypes()): ProfitAndLoss {
  const tb = trialBalance(entries);
  let revenue = 0, expense = 0;
  for (const a of tb) {
    const t = types[a.account];
    // 収益は貸方残(credit - debit)、費用は借方残(debit - credit)
    if (t === "revenue") revenue += a.credit - a.debit;
    else if (t === "expense") expense += a.debit - a.credit;
  }
  return { revenue, expense, netIncome: revenue - expense };
}

/** 貸借集計の結果。 */
export interface BalanceSheet {
  assets: number;
  liabilities: number;
  /** 純資産(資産 − 負債。当期損益を含む)。 */
  equity: number;
}

/** 仕訳から資産・負債・純資産を集計する。 */
export function balanceSheet(entries: JournalEntry[], types: AccountTypeMap = defaultAccountTypes()): BalanceSheet {
  const tb = trialBalance(entries);
  let assets = 0, liabilities = 0;
  for (const a of tb) {
    const t = types[a.account];
    if (t === "asset") assets += a.debit - a.credit;
    else if (t === "liability") liabilities += a.credit - a.debit;
  }
  return { assets, liabilities, equity: assets - liabilities };
}

/** 部門別の残高。 */
export interface DepartmentBalance {
  department: string;
  debit: number;
  credit: number;
  balance: number;
}

/** 部門ごとの借方/貸方/残高を集計する(department 指定のある明細のみ)。 */
export function departmentSummary(entries: JournalEntry[]): DepartmentBalance[] {
  const map = new Map<string, { debit: number; credit: number }>();
  const order: string[] = [];
  for (const entry of entries) {
    for (const line of entry.lines) {
      if (!line.department) continue;
      if (!map.has(line.department)) { map.set(line.department, { debit: 0, credit: 0 }); order.push(line.department); }
      const d = map.get(line.department)!;
      d.debit += line.debit;
      d.credit += line.credit;
    }
  }
  return order.map((department) => { const d = map.get(department)!; return { department, debit: d.debit, credit: d.credit, balance: d.debit - d.credit }; });
}

/** 部門別の損益(費用・収益を区分で集計)。 */
export function profitAndLossByDepartment(entries: JournalEntry[], types: AccountTypeMap = defaultAccountTypes()): Record<string, ProfitAndLoss> {
  const result: Record<string, { revenue: number; expense: number }> = {};
  for (const entry of entries) {
    for (const line of entry.lines) {
      if (!line.department) continue;
      const t = types[line.account];
      const r = (result[line.department] ??= { revenue: 0, expense: 0 });
      if (t === "revenue") r.revenue += line.credit - line.debit;
      else if (t === "expense") r.expense += line.debit - line.credit;
    }
  }
  const out: Record<string, ProfitAndLoss> = {};
  for (const [dep, r] of Object.entries(result)) out[dep] = { revenue: r.revenue, expense: r.expense, netIncome: r.revenue - r.expense };
  return out;
}
