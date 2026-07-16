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

/**
 * n 回目の請求日を返す。
 *
 * @param schedule 定期請求の設定
 * @param index 回数(**0 始まり**)
 * @returns 請求日
 */
export function billingDateAt(schedule: RecurringSchedule, index: number): string {
  return iso(addMonths(toDate(schedule.startDate), index * intervalMonths(schedule.interval)));
}

/**
 * 次の請求日を返す。
 *
 * @param schedule 定期請求の設定
 * @param from 基準日(**この日を含む**)
 * @returns 次の請求日。**終了後は null**
 */
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

/**
 * 期間内の請求日をすべて返す。
 *
 * @param schedule 定期請求の設定
 * @param from 開始(含む)
 * @param to 終了(含む)
 * @returns 請求日の配列
 */
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

/**
 * 今請求すべきかを判定する。
 *
 * **前回の請求日以降に請求日が来ているか**で見る。バッチが止まっていても、
 * 復旧時にまとめて処理できる(取りこぼさない)。
 *
 * @param schedule 定期請求の設定
 * @param lastIssuedAt 前回の請求日
 * @param asOf 基準日(テスト注入用)
 * @returns 請求すべきなら true
 */
export function dueForBilling(schedule: RecurringSchedule, asOf: string, lastBilled?: string): boolean {
  const from = lastBilled ? iso(addMonths(toDate(lastBilled), 0)) : schedule.startDate;
  const next = lastBilled ? nextBillingDate(schedule, iso(new Date(toDate(lastBilled).getTime() + 86_400_000))) : nextBillingDate(schedule, from);
  return next != null && toDate(next).getTime() <= toDate(asOf).getTime();
}
