"use client";
/**
 * ミニカレンダー。1 ヶ月の日付グリッドを表示し、土日・祝日をハイライトする。
 * @packageDocumentation
 */
import * as React from "react";
import {
  startOfMonth, endOfMonth, dayOfWeek, dayNumber, isHoliday, holidayName, isSameDay, addMonths,
} from "@platform/datetime";
import { cn } from "../lib/cn";

/** {@link MiniCalendar} の props。 */
export interface MiniCalendarProps {
  /** 表示月(既定は現在月)。 */
  month?: Date;
  /** 選択中の日。 */
  selected?: Date;
  /** 日付クリック。 */
  onSelect?: (date: Date) => void;
  /** 月移動を許可(前月/次月ボタン)。 */
  navigable?: boolean;
  className?: string;
}

const WEEK_HEAD = ["日", "月", "火", "水", "木", "金", "土"];
const MS_PER_DAY = 86_400_000;

/** ミニカレンダー(祝日ハイライト付き)。 */
export function MiniCalendar({ month, selected, onSelect, navigable = false, className }: MiniCalendarProps) {
  const [viewMonth, setViewMonth] = React.useState<Date>(month ?? startOfMonth(new Date()));
  const first = startOfMonth(viewMonth);
  const last = endOfMonth(viewMonth);
  const leading = dayOfWeek(first); // 日曜=0
  const cells: Array<Date | null> = [];
  for (let i = 0; i < leading; i++) cells.push(null);
  for (let dn = dayNumber(first); dn <= dayNumber(last); dn++) cells.push(new Date(dn * MS_PER_DAY));
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className={cn("inline-block rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-2 text-sm", className)}>
      <div className="mb-1 flex items-center justify-between px-1">
        {navigable ? <button type="button" onClick={() => setViewMonth((m) => addMonths(m, -1))} className="px-1 text-[var(--color-muted)] hover:text-[var(--color-fg)]">‹</button> : <span />}
        <span className="font-semibold">{first.getUTCFullYear()}年{first.getUTCMonth() + 1}月</span>
        {navigable ? <button type="button" onClick={() => setViewMonth((m) => addMonths(m, 1))} className="px-1 text-[var(--color-muted)] hover:text-[var(--color-fg)]">›</button> : <span />}
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {WEEK_HEAD.map((w, i) => (
          <div key={w} className={cn("py-1 text-xs font-medium", i === 0 && "text-red-500", i === 6 && "text-blue-500", i > 0 && i < 6 && "text-[var(--color-muted)]")}>{w}</div>
        ))}
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const dow = dayOfWeek(d);
          const holiday = isHoliday(d);
          const isSel = selected && isSameDay(d, selected);
          const color = holiday || dow === 0 ? "text-red-500" : dow === 6 ? "text-blue-500" : "text-[var(--color-fg)]";
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelect?.(d)}
              title={holidayName(d) ?? undefined}
              className={cn(
                "aspect-square rounded tabular-nums hover:bg-[var(--color-muted)]/15",
                color,
                isSel && "bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary)]",
                holiday && !isSel && "bg-red-50",
              )}
            >
              {d.getUTCDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
