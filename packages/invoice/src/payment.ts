/**
 * 支払期限・入金状態(純ロジック)。
 * @packageDocumentation
 */

/**
 * 支払期限を求める(発行日からの日数)。
 *
 * @param issueDate 発行日
 * @param termDays 日数
 * @returns 支払期限
 */
export function dueDateFrom(issueDate: string | Date, termDays: number): string {
  // **UTC で通す。** `setDate`/`getDate` はローカル時刻で動くのに `toISOString` は UTC なので、
  // 混ぜると JST 機で日付が 1 日ずれる(CI は UTC なので気づけない)。
  const d = new Date(issueDate);
  d.setUTCDate(d.getUTCDate() + termDays);
  return d.toISOString().slice(0, 10);
}

/**
 * 翌月末を返す(月末締め翌月末払い)。
 *
 * **日本の商習慣で最も多い支払条件**。
 *
 * @param issueDate 基準日
 * @returns 翌月末の日付
 */
export function endOfNextMonth(issueDate: string | Date): string {
  // **UTC で組み立てる。** `new Date(y, m, 0)` はローカル時刻の 0 時を作るため、
  // JST 機では UTC に直したときに前日へ回り、**支払期日が 1 日早くなる**。
  const d = new Date(issueDate);
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 2, 0));
  return end.toISOString().slice(0, 10);
}

/** 入金状態。 */
export type PaymentStatus = "draft" | "issued" | "paid" | "overdue" | "cancelled";

/**
 * 入金状況から状態を判定する。
 *
 * @param invoice 請求書
 * @param now 入金の配列
 * @returns `unpaid` / `partial` / `paid` / `overpaid`(**過入金も検出する**。
 *   放置すると返金漏れになる)
 */
export function paymentStatus(
  invoice: { issued: boolean; cancelled?: boolean; dueDate: string; paidAmount: number; total: number },
  now: Date = new Date(),
): PaymentStatus {
  if (invoice.cancelled) return "cancelled";
  if (!invoice.issued) return "draft";
  if (invoice.paidAmount >= invoice.total) return "paid";
  // 日付だけの比較。UTC で揃える(ローカル時刻で作ると実行環境で結果が変わる)
  const due = new Date(invoice.dueDate);
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return today > due ? "overdue" : "issued";
}

/**
 * 未収残高を返す。
 *
 * @param total 請求書
 * @param paidAmount 入金の配列
 * @returns 残高(**過入金ならマイナス**)
 */
export function balanceDue(total: number, paidAmount: number): number {
  return Math.max(0, total - paidAmount);
}

/**
 * 支払期限までの日数を返す。
 *
 * @param dueDate 請求書
 * @param now 基準日(テスト注入用)
 * @returns 残り日数(**過ぎていれば負**)
 */
export function daysUntilDue(dueDate: string | Date, now: Date = new Date()): number {
  // 日付だけの比較。UTC で揃える(ローカル時刻で作ると実行環境で結果が変わる)
  const due = new Date(dueDate);
  const a = Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate());
  const b = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((a - b) / 86_400_000);
}
