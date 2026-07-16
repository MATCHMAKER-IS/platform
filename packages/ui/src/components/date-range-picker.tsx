"use client";
/**
 * 期間選択カレンダー。2 クリックで開始日・終了日を選び、範囲をハイライトする。
 * @packageDocumentation
 */
import * as React from "react";
import { startOfMonth, endOfMonth, dayOfWeek, dayNumber, isHoliday, holidayName, isSameDay, addMonths } from "@platform/datetime";
import { cn } from "../lib/cn";

/** 選択された期間。 */
export interface PickedRange { start: Date; end: Date | null }

/** {@link DateRangePicker} の props。 */
export interface DateRangePickerProps {
  value?: PickedRange;
  onChange?: (range: PickedRange) => void;
  month?: Date;
  className?: string;
}

const WEEK_HEAD = ["日", "月", "火", "水", "木", "金", "土"];
const MS_PER_DAY = 86_400_000;

/** 期間選択カレンダー。 */
export function DateRangePicker({ value, onChange, month, className }: DateRangePickerProps) {
  const [viewMonth, setViewMonth] = React.useState<Date>(month ?? startOfMonth(new Date()));
  const [range, setRange] = React.useState<PickedRange | null>(value ?? null);
  const cur = value ?? range;

  const click = (d: Date) => {
    let next: PickedRange;
    if (!cur || cur.end != null) next = { start: d, end: null };
    else if (dayNumber(d) >= dayNumber(cur.start)) next = { start: cur.start, end: d };
    else next = { start: d, end: null };
    setRange(next);
    onChange?.(next);
  };

  const inRange = (d: Date) => {
    if (!cur) return false;
    const dn = dayNumber(d);
    const s = dayNumber(cur.start);
    const e = cur.end ? dayNumber(cur.end) : s;
    return dn >= Math.min(s, e) && dn <= Math.max(s, e);
  };

  const first = startOfMonth(viewMonth);
  const last = endOfMonth(viewMonth);
  const cells: Array<Date | null> = [];
  for (let i = 0; i < dayOfWeek(first); i++) cells.push(null);
  for (let dn = dayNumber(first); dn <= dayNumber(last); dn++) cells.push(new Date(dn * MS_PER_DAY));
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className={cn("inline-block rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-2 text-sm", className)}>
      <div className="mb-1 flex items-center justify-between px-1">
        <button type="button" onClick={() => setViewMonth((m) => addMonths(m, -1))} className="px-1 text-[var(--color-muted)] hover:text-[var(--color-fg)]">‹</button>
        <span className="font-semibold">{first.getUTCFullYear()}年{first.getUTCMonth() + 1}月</span>
        <button type="button" onClick={() => setViewMonth((m) => addMonths(m, 1))} className="px-1 text-[var(--color-muted)] hover:text-[var(--color-fg)]">›</button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {WEEK_HEAD.map((w, i) => <div key={w} className={cn("py-1 text-xs font-medium", i === 0 && "text-red-500", i === 6 && "text-blue-500", i > 0 && i < 6 && "text-[var(--color-muted)]")}>{w}</div>)}
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const dow = dayOfWeek(d);
          const selectedEnd = cur && (isSameDay(d, cur.start) || (cur.end && isSameDay(d, cur.end)));
          const within = inRange(d) && !selectedEnd;
          const color = isHoliday(d) || dow === 0 ? "text-red-500" : dow === 6 ? "text-blue-500" : "text-[var(--color-fg)]";
          return (
            <button key={i} type="button" onClick={() => click(d)} title={holidayName(d) ?? undefined}
              className={cn("aspect-square rounded tabular-nums hover:bg-[var(--color-muted)]/15", color, within && "bg-[var(--color-primary)]/15", selectedEnd && "bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary)]")}>
              {d.getUTCDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
