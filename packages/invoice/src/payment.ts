/**
 * 支払期限・入金状態(純ロジック)。
 * @packageDocumentation
 */

/** 支払条件(発行日からの日数)。 */
export function dueDateFrom(issueDate: string | Date, termDays: number): string {
  const d = new Date(issueDate);
  d.setDate(d.getDate() + termDays);
  return d.toISOString().slice(0, 10);
}

/** 月末締め翌月末払いなどの「翌月末」を返す。 */
export function endOfNextMonth(issueDate: string | Date): string {
  const d = new Date(issueDate);
  const end = new Date(d.getFullYear(), d.getMonth() + 2, 0);
  return end.toISOString().slice(0, 10);
}

/** 入金状態。 */
export type PaymentStatus = "draft" | "issued" | "paid" | "overdue" | "cancelled";

/** 入金状況から状態を判定する。 */
export function paymentStatus(
  invoice: { issued: boolean; cancelled?: boolean; dueDate: string; paidAmount: number; total: number },
  now: Date = new Date(),
): PaymentStatus {
  if (invoice.cancelled) return "cancelled";
  if (!invoice.issued) return "draft";
  if (invoice.paidAmount >= invoice.total) return "paid";
  const due = new Date(invoice.dueDate);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return today > due ? "overdue" : "issued";
}

/** 未収残高。 */
export function balanceDue(total: number, paidAmount: number): number {
  return Math.max(0, total - paidAmount);
}

/** 支払期限までの日数(過ぎていれば負)。 */
export function daysUntilDue(dueDate: string | Date, now: Date = new Date()): number {
  const due = new Date(dueDate);
  const a = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((a - b) / 86_400_000);
}
