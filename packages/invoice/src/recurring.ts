/**
 * 定期請求(サブスク・純ロジック)。請求サイクルから次回請求日や期間内の請求日を求める。
 * 日付計算は @platform/datetime(月末クランプ)。
 * @packageDocumentation
 */
import { addMonths } from "@platform/datetime";

/** 請求間隔。 */
export type BillingInterval = "monthly" | "quarterly" | "yearly";

/** 定期請求スケジュール。 */
export interface RecurringSchedule {
  interval: BillingInterval;
  /** 開始日(ISO 日付)。 */
  startDate: string;
  /** 終了日(ISO 日付。無ければ無期限)。 */
  endDate?: string;
}

function intervalMonths(interval: BillingInterval): number {
  return interval === "monthly" ? 1 : interval === "quarterly" ? 3 : 12;
}

function toDate(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`);
}

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** 開始日から数えて index 回目(0 始まり)の請求日。 */
export function billingDateAt(schedule: RecurringSchedule, index: number): string {
  return iso(addMonths(toDate(schedule.startDate), index * intervalMonths(schedule.interval)));
}

/** from(含む)以降で最初の請求日。終了後は null。 */
export function nextBillingDate(schedule: RecurringSchedule, from: string): string | null {
  const start = toDate(schedule.startDate);
  const fromD = toDate(from);
  const step = intervalMonths(schedule.interval);
  let i = 0;
  let d = start;
  while (d.getTime() < fromD.getTime()) {
    i += 1;
    d = addMonths(start, i * step);
  }
  if (schedule.endDate && d.getTime() > toDate(schedule.endDate).getTime()) return null;
  return iso(d);
}

/** from〜to(両端含む)の請求日をすべて返す。 */
export function billingDatesBetween(schedule: RecurringSchedule, from: string, to: string): string[] {
  const start = toDate(schedule.startDate);
  const toD = toDate(to);
  const fromD = toDate(from);
  const end = schedule.endDate ? Math.min(toD.getTime(), toDate(schedule.endDate).getTime()) : toD.getTime();
  const step = intervalMonths(schedule.interval);
  const out: string[] = [];
  for (let i = 0; ; i++) {
    const d = addMonths(start, i * step);
    if (d.getTime() > end) break;
    if (d.getTime() >= fromD.getTime()) out.push(iso(d));
  }
  return out;
}

/** asOf 時点で請求すべきか(前回請求日以降に請求日が到来しているか)。 */
export function dueForBilling(schedule: RecurringSchedule, asOf: string, lastBilled?: string): boolean {
  const from = lastBilled ? iso(addMonths(toDate(lastBilled), 0)) : schedule.startDate;
  const next = lastBilled ? nextBillingDate(schedule, iso(new Date(toDate(lastBilled).getTime() + 86_400_000))) : nextBillingDate(schedule, from);
  return next != null && toDate(next).getTime() <= toDate(asOf).getTime();
}
