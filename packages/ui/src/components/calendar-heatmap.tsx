"use client";
/**
 * カレンダーヒートマップ。日付ごとの件数を濃淡で表示する(コントリビューショングラフ風)。
 * @packageDocumentation
 */
import { dayNumber, dayOfWeek, startOfWeek, formatDate } from "@platform/datetime";
import { cn } from "../lib/cn";

/** {@link CalendarHeatmap} の props。 */
export interface CalendarHeatmapProps {
  /** 日付(YYYY-MM-DD)→件数。 */
  counts: Record<string, number>;
  start: Date;
  end: Date;
  /** セル 1 辺(px)。 */
  cellSize?: number;
  className?: string;
}

const MS_PER_DAY = 86_400_000;

/** カレンダーヒートマップ。 */
export function CalendarHeatmap({ counts, start, end, cellSize = 12, className }: CalendarHeatmapProps) {
  const gridStart = startOfWeek(start, 0); // 日曜始まり
  const startDn = dayNumber(gridStart);
  const endDn = dayNumber(end);
  const max = Math.max(1, ...Object.values(counts));

  const weeks: Array<Array<{ date: Date; count: number } | null>> = [];
  let week: Array<{ date: Date; count: number } | null> = [];
  for (let dn = startDn; dn <= endDn; dn++) {
    const date = new Date(dn * MS_PER_DAY);
    if (dayOfWeek(date) === 0 && week.length) { weeks.push(week); week = []; }
    week.push(dn >= dayNumber(start) ? { date, count: counts[formatDate(date)] ?? 0 } : null);
  }
  if (week.length) weeks.push(week);

  const intensity = (c: number) => (c === 0 ? 0 : Math.min(4, 1 + Math.floor((c / max) * 3)));
  const shades = ["var(--color-muted)/15", "rgb(187 247 208)", "rgb(74 222 128)", "rgb(34 197 94)", "rgb(21 128 61)"];

  return (
    <div className={cn("inline-flex gap-0.5", className)}>
      {weeks.map((wk, wi) => (
        <div key={wi} className="flex flex-col gap-0.5">
          {wk.map((cell, di) => (
            <div key={di} title={cell ? `${formatDate(cell.date)}: ${cell.count}` : undefined}
              className="rounded-[2px]"
              style={{ width: cellSize, height: cellSize, background: cell ? shades[intensity(cell.count)] : "transparent" }} />
          ))}
        </div>
      ))}
    </div>
  );
}
