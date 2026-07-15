/**
 * 予約リマインダー(純ロジック)。
 * 予約日時とリマインダー設定(前日・当日・1時間前など)から、通知の発火時刻・宛先チャネル・
 * 送るべき通知を計算する。実際の送信は @platform/mail / @platform/sms、定期実行は @platform/cron。
 * @packageDocumentation
 */

/** 通知チャネル。 */
export type ReminderChannel = "email" | "sms" | "line";

/** リマインダー設定。 */
export interface ReminderRule {
  /** 予約の何分前に送るか(例 1440=前日, 60=1時間前)。 */
  beforeMinutes: number;
  /** 送信チャネル。 */
  channel: ReminderChannel;
}

/** スケジュールされたリマインダー。 */
export interface ScheduledReminder {
  channel: ReminderChannel;
  beforeMinutes: number;
  /** 発火時刻(ISO 8601)。 */
  fireAt: string;
}

/** 予約日時とルールから発火予定を組み立てる(発火時刻の昇順)。 */
export function reminderSchedule(bookingAt: string | Date, rules: ReminderRule[]): ScheduledReminder[] {
  const base = (typeof bookingAt === "string" ? new Date(bookingAt) : bookingAt).getTime();
  return rules
    .map((r) => ({ channel: r.channel, beforeMinutes: r.beforeMinutes, fireAt: new Date(base - r.beforeMinutes * 60_000).toISOString() }))
    .sort((a, b) => new Date(a.fireAt).getTime() - new Date(b.fireAt).getTime());
}

/** リマインダーの一意キー(送信済み管理用)。 */
export function reminderKey(bookingId: string, reminder: { channel: ReminderChannel; beforeMinutes: number }): string {
  return `${bookingId}:${reminder.channel}:${reminder.beforeMinutes}`;
}

/**
 * 今送るべきリマインダーを返す(発火時刻を過ぎ、まだ送っていないもの)。
 * cron で定期的に呼び、返ったものを送信して sent に記録する運用を想定。
 * @param sentKeys 送信済みキー(reminderKey)
 * @param graceMinutes 発火から何分までを対象にするか(遅延実行の取りこぼし防止・既定 実質無制限)
 */
export function dueReminders(
  bookingId: string,
  scheduled: ScheduledReminder[],
  now: Date = new Date(),
  options: { sentKeys?: Iterable<string>; graceMinutes?: number } = {},
): ScheduledReminder[] {
  const sent = new Set(options.sentKeys ?? []);
  const nowMs = now.getTime();
  return scheduled.filter((r) => {
    const fireMs = new Date(r.fireAt).getTime();
    if (fireMs > nowMs) return false; // まだ
    if (options.graceMinutes !== undefined && nowMs - fireMs > options.graceMinutes * 60_000) return false; // 古すぎ
    return !sent.has(reminderKey(bookingId, r));
  });
}

/** リマインダーのタイミング区分。 */
export type ReminderTiming = "day_before" | "same_day" | "soon";

/** 何分前かからタイミング区分を判定する。 */
export function reminderTiming(beforeMinutes: number): ReminderTiming {
  if (beforeMinutes >= 1440) return "day_before";
  if (beforeMinutes > 120) return "same_day";
  return "soon";
}

/** リマインダー本文(日本語)を組み立てる。 */
export function reminderMessage(input: {
  customerName?: string;
  bookingAt: string | Date;
  beforeMinutes: number;
  place?: string;
}): string {
  const d = typeof input.bookingAt === "string" ? new Date(input.bookingAt) : input.bookingAt;
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const timing = reminderTiming(input.beforeMinutes);
  const lead = timing === "day_before" ? "明日" : timing === "same_day" ? "本日" : "まもなく";
  const name = input.customerName ? `${input.customerName}様\n\n` : "";
  const place = input.place ? `\n場所: ${input.place}` : "";
  return `${name}${lead}${timing === "soon" ? "" : ` ${time}`}のご予約のお知らせです。${timing === "soon" ? `（${time}開始）` : ""}${place}\nお待ちしております。`;
}
