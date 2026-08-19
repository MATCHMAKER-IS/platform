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

/**
 * 仕訳を外部会計 SaaS(freee 等)へ送信する。send は接続先ごとに注入。
 *
 * **`unknown`(送ったか分からない)が出たら、そのままにしない。**
 * 通信が切れた場合、相手に届いているかもしれないし届いていないかもしれない。
 *
 * - `alreadySent` に入れる → 再送されない。**届いていなければ欠落**
 * - 入れない → 再送される。**届いていれば二重計上**
 *
 * **どちらも危険なので、自動で決めない。** `pending` として返し、
 * **人が相手側で確認してから**「送信済み」か「未送信」かを決める。
 *
 * 呼び出し側は `pending.length > 0` のとき**必ず通知を出すこと**
 * ——ログだけでは気づけず、気づくのは決算のときになる(2026-08)。
 *
 * @param entries 送る仕訳
 * @param send 送信する関数(接続先ごとに注入)
 * @param accountItemIds 勘定科目名 → ID の対応表
 * @param alreadySent 送信済みの冪等キー(再実行時の二重登録を防ぐ)
 * @returns 送信結果と集計、**確認が要る冪等キーの一覧**(`pending`)
 */
export async function syncToAccountingSaaS(entries: JournalEntry[], send: Sender, accountItemIds: Record<string, number>, alreadySent?: Set<string>) {
  const result = await syncJournals(entries, { send, accountItemIds, alreadySent });
  const summary = summarizeSync(result.results);
  // **送ったか分からないものを取り出す。** ここを見ずに再実行すると二重計上になる
  const pending = result.results.filter((r) => r.status === "unknown").map((r) => r.key);
  return { ...result, summary, pending, needsConfirmation: pending.length > 0 };
}
