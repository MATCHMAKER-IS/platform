/**
 * 共通 DatePicker / TimePicker。ブラウザ標準の日付/時刻入力をトークンで整形する。
 * ロケール・モバイル・アクセシビリティを OS 側に委ねられ堅牢。値は文字列
 * (date: "YYYY-MM-DD" / time: "HH:mm")。
 * @packageDocumentation
 */
import * as React from "react";
import { cn } from "../lib/cn";

const fieldClass =
  "h-9 w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm text-[var(--color-fg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] disabled:opacity-50";

/** 日付入力(`<input type="date">`)。値は "YYYY-MM-DD"。 */
/**
 * 日付の入力。
 *
 * 端末の日付選択が出るので、**手入力の書式ゆれ(2026/7/1 と 2026-07-01)を防げる**。
 * 値は `YYYY-MM-DD` の文字列で入出力する(`@platform/datetime` の関数がそのまま使える)。
 *
 * - 期間を選ばせるなら `DateRangePicker`
 * - 時刻も要るなら `DateTimePicker`(別々に並べるより間違いが少ない)
 * - `min` / `max` を付けると、選べない日を最初から潰せる(後から怒られない)
 *
 * @example
 * ```tsx
 * <DatePicker value={date} min="2026-04-01" max="2027-03-31"
 *   onChange={(e) => setDate(e.target.value)} />
 * ```
 */
export const DatePicker = React.forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">
>(({ className, ...props }, ref) => (
  <input ref={ref} type="date" className={cn(fieldClass, className)} {...props} />
));
DatePicker.displayName = "DatePicker";

/** 時刻入力(`<input type="time">`)。値は "HH:mm"。 */
export const TimePicker = React.forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">
>(({ className, ...props }, ref) => (
  <input ref={ref} type="time" className={cn(fieldClass, className)} {...props} />
));
TimePicker.displayName = "TimePicker";

/** 日時入力(`<input type="datetime-local">`)。 */
export const DateTimePicker = React.forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">
>(({ className, ...props }, ref) => (
  <input ref={ref} type="datetime-local" className={cn(fieldClass, className)} {...props} />
));
DateTimePicker.displayName = "DateTimePicker";
