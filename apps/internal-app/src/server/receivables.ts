/**
 * 売掛金の集計（アプリ側の組み合わせ）。エイジングと督促を @platform/invoice に委譲する。
 * @packageDocumentation
 */
import { agingBuckets, outstandingTotal, dunningLevel, dunningMessage, balanceDue, type AgingBuckets, type OpenInvoice, type DunningLevel } from "@platform/invoice";

/** 督促対象の 1 件。 */
export interface DunningItem {
  number: string;
  billTo: string;
  dueDate: string;
  amountDue: number;
  overdueDays: number;
  level: DunningLevel;
  message: string;
}

/** 売掛サマリー。 */
export interface ReceivablesSummary {
  aging: AgingBuckets;
  outstanding: number;
  dunning: DunningItem[];
}

/** サマリーに渡す請求書の最小形。 */
export interface ReceivableInvoice {
  number: string;
  billTo: string;
  dueDate: string;
  total: number;
  paidAmount: number;
  cancelled: boolean;
}

function overdueDaysOf(dueDate: string, now: Date): number {
  const due = new Date(dueDate);
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.floor((today - dueDay) / 86_400_000);
}

/** 未収の請求書からエイジングと督促文面を作る。取消・完済は除外。 */
export function receivablesSummary(invoices: ReceivableInvoice[], now: Date = new Date()): ReceivablesSummary {
  const open: OpenInvoice[] = invoices
    .filter((i) => !i.cancelled && balanceDue(i.total, i.paidAmount) > 0)
    .map((i) => ({ number: i.number, dueDate: i.dueDate, total: i.total, paidAmount: i.paidAmount }));
  const dunning: DunningItem[] = [];
  for (const i of invoices) {
    if (i.cancelled) continue;
    const amountDue = balanceDue(i.total, i.paidAmount);
    if (amountDue <= 0) continue;
    const overdueDays = overdueDaysOf(i.dueDate, now);
    const level = dunningLevel(overdueDays);
    if (level === "none") continue;
    dunning.push({ number: i.number, billTo: i.billTo, dueDate: i.dueDate, amountDue, overdueDays, level, message: dunningMessage({ number: i.number, billTo: i.billTo, dueDate: i.dueDate, amountDue }, level) });
  }
  dunning.sort((a, b) => b.overdueDays - a.overdueDays);
  return { aging: agingBuckets(open, now), outstanding: outstandingTotal(open), dunning };
}
