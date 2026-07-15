/**
 * 業務イベントから仕訳を生成する(純ロジック）。
 * 売上(請求)・仕入(発注)・入金などを、勘定科目つきの複式仕訳に変換する。
 * @packageDocumentation
 */
import { type JournalEntry, type JournalLine } from "./journal.js";

/** 勘定科目名(既定。会社ごとに差し替え可）。 */
export interface AccountNames {
  receivable: string;   // 売掛金
  sales: string;        // 売上高
  outputTax: string;    // 仮受消費税
  purchase: string;     // 仕入高
  inputTax: string;     // 仮払消費税
  payable: string;      // 買掛金
  cash: string;         // 現金預金
  expense: string;      // 経費(既定の費用科目)
  unpaid: string;       // 未払金
  advance: string;      // 仮払金(立替・前渡)
  salary: string;       // 給与手当
  withholdingPayable: string;  // 預り金(源泉所得税)
  socialPayable: string;       // 預り金(社会保険)
}

/** 既定の勘定科目名。 */
export const DEFAULT_ACCOUNTS: AccountNames = {
  receivable: "売掛金",
  sales: "売上高",
  outputTax: "仮受消費税",
  purchase: "仕入高",
  inputTax: "仮払消費税",
  payable: "買掛金",
  cash: "現金預金",
  expense: "旅費交通費",
  unpaid: "未払金",
  advance: "仮払金",
  salary: "給与手当",
  withholdingPayable: "預り金(源泉所得税)",
  socialPayable: "預り金(社会保険)",
};

/** 売上（請求書発行）の仕訳: 売掛金 / 売上高・仮受消費税。 */
export function salesJournal(
  input: { date: string; description?: string; net: number; tax: number },
  accounts: AccountNames = DEFAULT_ACCOUNTS,
): JournalEntry {
  const total = input.net + input.tax;
  return {
    date: input.date,
    description: input.description ?? "売上",
    lines: [
      { account: accounts.receivable, debit: total, credit: 0 },
      { account: accounts.sales, debit: 0, credit: input.net },
      { account: accounts.outputTax, debit: 0, credit: input.tax },
    ],
  };
}

/** 仕入（発注・仕入計上）の仕訳: 仕入高・仮払消費税 / 買掛金。 */
export function purchaseJournal(
  input: { date: string; description?: string; net: number; tax: number },
  accounts: AccountNames = DEFAULT_ACCOUNTS,
): JournalEntry {
  const total = input.net + input.tax;
  return {
    date: input.date,
    description: input.description ?? "仕入",
    lines: [
      { account: accounts.purchase, debit: input.net, credit: 0 },
      { account: accounts.inputTax, debit: input.tax, credit: 0 },
      { account: accounts.payable, debit: 0, credit: total },
    ],
  };
}

/** 入金（売掛金回収）の仕訳: 現金預金 / 売掛金。 */
export function receiptJournal(
  input: { date: string; description?: string; amount: number },
  accounts: AccountNames = DEFAULT_ACCOUNTS,
): JournalEntry {
  return {
    date: input.date,
    description: input.description ?? "入金",
    lines: [
      { account: accounts.cash, debit: input.amount, credit: 0 },
      { account: accounts.receivable, debit: 0, credit: input.amount },
    ],
  };
}

/** 支払（買掛金支払）の仕訳: 買掛金 / 現金預金。 */
export function paymentJournal(
  input: { date: string; description?: string; amount: number },
  accounts: AccountNames = DEFAULT_ACCOUNTS,
): JournalEntry {
  return {
    date: input.date,
    description: input.description ?? "支払",
    lines: [
      { account: accounts.payable, debit: input.amount, credit: 0 },
      { account: accounts.cash, debit: 0, credit: input.amount },
    ],
  };
}

/** 経費精算の支払方法。 */
export type ExpensePayment = "unpaid" | "cash" | "advance";

/**
 * 経費精算の仕訳: 経費科目・仮払消費税 / 未払金 or 現金預金 or 仮払金。
 * 立替経費の未精算は unpaid(未払金)、即時現金払いは cash、仮払金からの精算は advance。
 * @param input.account 費用科目(未指定なら既定の経費科目)
 */
export function expenseJournal(
  input: { date: string; description?: string; net: number; tax: number; account?: string; payment?: ExpensePayment },
  accounts: AccountNames = DEFAULT_ACCOUNTS,
): JournalEntry {
  const total = input.net + input.tax;
  const creditAccount = input.payment === "cash" ? accounts.cash : input.payment === "advance" ? accounts.advance : accounts.unpaid;
  const lines: JournalLine[] = [
    { account: input.account ?? accounts.expense, debit: input.net, credit: 0 },
  ];
  if (input.tax > 0) lines.push({ account: accounts.inputTax, debit: input.tax, credit: 0 });
  lines.push({ account: creditAccount, debit: 0, credit: total });
  return { date: input.date, description: input.description ?? "経費精算", lines };
}

/**
 * 給与支給の仕訳: 給与手当 / 預り金(源泉所得税・社会保険)・未払金 or 現金預金。
 * 総支給から源泉・社保を控除し、差引の手取りを未払金(未払)または現金(支払済)で計上。
 */
export function payrollJournal(
  input: { date: string; description?: string; gross: number; withholdingTax: number; socialInsurance: number; paid?: boolean; department?: string },
  accounts: AccountNames = DEFAULT_ACCOUNTS,
): JournalEntry {
  const net = input.gross - input.withholdingTax - input.socialInsurance;
  const dep = input.department;
  const lines: JournalLine[] = [
    { account: accounts.salary, debit: input.gross, credit: 0, ...(dep ? { department: dep } : {}) },
  ];
  if (input.withholdingTax > 0) lines.push({ account: accounts.withholdingPayable, debit: 0, credit: input.withholdingTax });
  if (input.socialInsurance > 0) lines.push({ account: accounts.socialPayable, debit: 0, credit: input.socialInsurance });
  lines.push({ account: input.paid ? accounts.cash : accounts.unpaid, debit: 0, credit: net });
  return { date: input.date, description: input.description ?? "給与支給", lines };
}
