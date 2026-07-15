/**
 * 会計のアプリ層サービス(基盤 @platform/accounting の合成)。
 * 請求・入金・仕入イベントから仕訳を起こし、月次の損益・消費税を集計する。
 * @packageDocumentation
 */
import { salesJournal, purchaseJournal, receiptJournal, expenseJournal, payrollJournal, filterByPeriod, profitAndLoss, balanceSheet, consumptionTaxSummary, departmentSummary, profitAndLossByDepartment, syncJournals, summarizeSync, type JournalEntry, type RateAmount, type ExpensePayment, type Sender } from "@platform/accounting";

/** 請求書発行から売上仕訳を起こす。 */
export function recordSale(date: string, net: number, tax: number, description?: string): JournalEntry {
  return salesJournal({ date, net, tax, description });
}

/** 仕入計上から仕訳を起こす。 */
export function recordPurchase(date: string, net: number, tax: number, description?: string): JournalEntry {
  return purchaseJournal({ date, net, tax, description });
}

/** 入金から仕訳を起こす。 */
export function recordReceipt(date: string, amount: number, description?: string): JournalEntry {
  return receiptJournal({ date, amount, description });
}

/** 月次決算(損益・貸借)を集計する。 */
export function monthlyClosing(entries: JournalEntry[], yearMonth: string) {
  const period = filterByPeriod(entries, yearMonth);
  return { period: yearMonth, profitAndLoss: profitAndLoss(period), balanceSheet: balanceSheet(period) };
}

/** 消費税集計表を作る。 */
export function taxReport(sales: RateAmount[], purchases: RateAmount[]) {
  return consumptionTaxSummary(sales, purchases);
}

/** 承認済みの経費精算から仕訳を自動起票する（費用科目・支払方法つき）。 */
export function recordExpense(input: { date: string; net: number; tax: number; account?: string; payment?: ExpensePayment; description?: string }): JournalEntry {
  return expenseJournal(input);
}

/** 勤怠・給与計算の結果から給与支給の仕訳を起こす。 */
export function recordPayroll(input: { date: string; gross: number; withholdingTax: number; socialInsurance: number; paid?: boolean; department?: string }): JournalEntry {
  return payrollJournal(input);
}

/** 部門別の損益を集計する。 */
export function departmentClosing(entries: JournalEntry[], yearMonth: string) {
  const period = filterByPeriod(entries, yearMonth);
  return { period: yearMonth, byDepartment: profitAndLossByDepartment(period), balances: departmentSummary(period) };
}

/** 仕訳を外部会計 SaaS(freee 等)へ送信する。send は接続先ごとに注入。 */
export async function syncToAccountingSaaS(entries: JournalEntry[], send: Sender, accountItemIds: Record<string, number>, alreadySent?: Set<string>) {
  const result = await syncJournals(entries, { send, accountItemIds, alreadySent });
  return { ...result, summary: summarizeSync(result.results) };
}
