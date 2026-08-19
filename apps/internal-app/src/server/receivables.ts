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
  // **JST の日付で数える。** `getFullYear()` などはサーバのローカル時刻で動くので、
  // UTC のサーバでは **JST の 00:00〜08:59 が前日**になり、**滞留日数が 1 日短く出る**
  // ——督促の区分(30 日・60 日・90 日)の境目で判定が変わる(2026-08 に修正)。
  const jstMidnight = (d: Date): number =>
    Date.parse(`${new Date(d.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)}T00:00:00.000Z`);
  return Math.floor((jstMidnight(now) - jstMidnight(new Date(dueDate))) / 86_400_000);
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
