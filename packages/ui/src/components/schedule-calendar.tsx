"use client";
/**
 * 閲覧用スケジュールカレンダー(Google カレンダー風)。
 * 月 / 週 / 日 / 予定リストの 4 ビューを切り替えて予定を表示する。読み取り専用で、
 * クリックはコールバック(onEventClick / onDateClick)で受ける。配置計算は lib/schedule に分離。
 * @packageDocumentation
 */
import * as React from "react";
import { addMonths, addDays, isHoliday as isHolidayRaw, holidayName as holidayNameRaw } from "@platform/datetime";
import { cn } from "../lib/cn";
import {
  type CalendarEvent, buildMonthGrid, eventsForDay, layoutDayEvents, groupEventsByDay, formatEventTime, nowOffset,
} from "../lib/schedule";
import { CalendarLegend, type CalendarCategory } from "./calendar-legend";

/** カレンダーのビュー種別。 */
export type CalendarView = "month" | "week" | "day" | "agenda";

/** {@link ScheduleCalendar} の props。 */
export interface ScheduleCalendarProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onSelect"> {
  /** 表示するイベント。 */
  events: CalendarEvent[];
  /** ビュー(制御)。未指定なら内部状態。 */
  view?: CalendarView;
  /** 基準日(制御)。未指定なら内部状態(既定は今日)。 */
  date?: Date;
  /** ビュー変更時。 */
  onViewChange?: (view: CalendarView) => void;
  /** 基準日変更時(前後移動・今日)。 */
  onDateChange?: (date: Date) => void;
  /** イベントクリック。 */
  onEventClick?: (event: CalendarEvent) => void;
  /** 日付クリック(月表示のセル・日付見出し)。 */
  onDateClick?: (date: Date) => void;
  /** 週の開始曜日(0=日, 1=月。既定 0)。 */
  weekStartsOn?: 0 | 1;
  /** 時間グリッドの表示開始/終了時(既定 0..24)。 */
  dayStartHour?: number;
  dayEndHour?: number;
  /** カテゴリ凡例(渡すとヘッダ下に表示・クリックで表示/非表示フィルタ)。 */
  categories?: CalendarCategory[];
}

const WEEK_HEAD_SUN = ["日", "月", "火", "水", "木", "金", "土"];

/** ローカル日付の曜日名(日本語)。 */
function weekdayJa(d: Date): string { return WEEK_HEAD_SUN[d.getDay()]!; }
/** ローカル Y/M/D を UTC 深夜に正規化して datetime(UTC基準)の祝日照会に渡す。 */
function toUtcMidnight(d: Date): Date { return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); }
function isHoliday(d: Date): boolean { return isHolidayRaw(toUtcMidnight(d)); }
function holidayName(d: Date): string | null { return holidayNameRaw(toUtcMidnight(d)); }
/** ローカル基準の週初め。 */
function startOfWeekLocal(date: Date, weekStartsOn: 0 | 1): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = (d.getDay() - weekStartsOn + 7) % 7;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - diff);
}

function useControlled<T>(controlled: T | undefined, initial: T): [T, (v: T) => void] {
  const [internal, setInternal] = React.useState<T>(initial);
  return [controlled ?? internal, setInternal];
}

/** 閲覧用スケジュールカレンダー。 */
export function ScheduleCalendar({
  events, view: viewProp, date: dateProp, onViewChange, onDateChange, onEventClick, onDateClick,
  weekStartsOn = 0, dayStartHour = 0, dayEndHour = 24, categories, className, ...props
}: ScheduleCalendarProps) {
  const [view, setView] = useControlled(viewProp, "month" as CalendarView);
  const [date, setDate] = useControlled(dateProp, new Date());
  const changeView = (v: CalendarView) => { onViewChange?.(v); if (viewProp === undefined) setView(v); };
  const changeDate = (d: Date) => { onDateChange?.(d); if (dateProp === undefined) setDate(d); };

  const [hiddenCats, setHiddenCats] = React.useState<string[]>([]);
  const shownEvents = React.useMemo(
    () => (categories && hiddenCats.length ? events.filter((e) => !e.category || !hiddenCats.includes(e.category)) : events),
    [events, hiddenCats, categories],
  );

  const move = (dir: -1 | 1) => {
    if (view === "month") changeDate(addMonths(date, dir));
    else if (view === "week") changeDate(addDays(date, dir * 7));
    else changeDate(addDays(date, dir));
  };

  const title = React.useMemo(() => {
    if (view === "month") return `${date.getFullYear()}年${date.getMonth() + 1}月`;
    if (view === "day") return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日(${weekdayJa(date)})`;
    if (view === "week") {
      const s = startOfWeekLocal(date, weekStartsOn);
      const e = addDays(s, 6);
      return `${s.getFullYear()}年${s.getMonth() + 1}月${s.getDate()}日 – ${e.getMonth() + 1}月${e.getDate()}日`;
    }
    return `${date.getFullYear()}年${date.getMonth() + 1}月`;
  }, [view, date, weekStartsOn]);

  return (
    <div className={cn("flex flex-col rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)]", className)} {...props}>
      {/* ヘッダ */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] p-3">
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => changeDate(new Date())} className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm hover:bg-slate-50">今日</button>
          <button type="button" aria-label="前へ" onClick={() => move(-1)} className="rounded-md px-2 py-1.5 text-[var(--color-muted)] hover:bg-slate-100">‹</button>
          <button type="button" aria-label="次へ" onClick={() => move(1)} className="rounded-md px-2 py-1.5 text-[var(--color-muted)] hover:bg-slate-100">›</button>
          <span className="ml-1 text-base font-semibold">{title}</span>
        </div>
        <div className="inline-flex rounded-md border border-[var(--color-border)] p-0.5 text-sm">
          {([["month", "月"], ["week", "週"], ["day", "日"], ["agenda", "予定"]] as [CalendarView, string][]).map(([v, label]) => (
            <button key={v} type="button" onClick={() => changeView(v)}
              className={cn("rounded px-3 py-1", view === v ? "bg-[var(--color-primary)] text-[var(--color-primary-fg)]" : "text-[var(--color-fg)] hover:bg-slate-100")}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {/* カテゴリ凡例(フィルタ) */}
      {categories && categories.length > 0 && (
        <div className="border-b border-[var(--color-border)] px-3 py-2">
          <CalendarLegend
            categories={categories}
            hiddenIds={hiddenCats}
            onToggle={(id) => setHiddenCats((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))}
          />
        </div>
      )}
      {/* 本体 */}
      {view === "month" && <MonthView date={date} events={shownEvents} weekStartsOn={weekStartsOn} onEventClick={onEventClick} onDateClick={onDateClick} />}
      {view === "week" && <TimeGridView days={weekDays(date, weekStartsOn)} events={shownEvents} dayStartHour={dayStartHour} dayEndHour={dayEndHour} onEventClick={onEventClick} onDateClick={onDateClick} />}
      {view === "day" && <TimeGridView days={[startOfLocalDay(date)]} events={shownEvents} dayStartHour={dayStartHour} dayEndHour={dayEndHour} onEventClick={onEventClick} onDateClick={onDateClick} />}
      {view === "agenda" && <AgendaView events={shownEvents} onEventClick={onEventClick} onDateClick={onDateClick} />}
    </div>
  );
}

function startOfLocalDay(d: Date): Date { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function weekDays(date: Date, weekStartsOn: 0 | 1): Date[] {
  const s = startOfWeekLocal(date, weekStartsOn);
  return Array.from({ length: 7 }, (_, i) => addDays(startOfLocalDay(s), i));
}

/** 月表示。 */
function MonthView({ date, events, weekStartsOn, onEventClick, onDateClick }: {
  date: Date; events: CalendarEvent[]; weekStartsOn: 0 | 1;
  onEventClick?: (e: CalendarEvent) => void; onDateClick?: (d: Date) => void;
}) {
  const grid = buildMonthGrid(date, { weekStartsOn });
  const head = weekStartsOn === 1 ? [...WEEK_HEAD_SUN.slice(1), WEEK_HEAD_SUN[0]!] : WEEK_HEAD_SUN;
  const MAX = 3;
  return (
    <div className="flex flex-1 flex-col">
      <div className="grid grid-cols-7 border-b border-[var(--color-border)] text-center text-xs text-[var(--color-muted)]">
        {head.map((h, i) => <div key={i} className="py-1.5">{h}</div>)}
      </div>
      <div className="grid flex-1 auto-rows-fr grid-cols-7">
        {grid.flat().map((cell, i) => {
          const dayEvents = eventsForDay(events, cell.date);
          const hol = isHoliday(cell.date);
          const wd = cell.date.getDay();
          return (
            <div key={i} className={cn("min-h-[5rem] border-b border-r border-[var(--color-border)] p-1", !cell.inMonth && "bg-slate-50/60")}>
              <button type="button" onClick={() => onDateClick?.(cell.date)}
                className={cn(
                  "mb-0.5 flex h-6 w-6 items-center justify-center rounded-full text-xs",
                  cell.isToday && "bg-[var(--color-primary)] font-semibold text-[var(--color-primary-fg)]",
                  !cell.isToday && !cell.inMonth && "text-[var(--color-muted)]",
                  !cell.isToday && cell.inMonth && (hol || wd === 0) && "text-red-500",
                  !cell.isToday && cell.inMonth && wd === 6 && "text-sky-600",
                )}
                title={holidayName(cell.date) ?? undefined}
              >
                {cell.date.getDate()}
              </button>
              <div className="space-y-0.5">
                {dayEvents.slice(0, MAX).map((e) => (
                  <button key={e.id} type="button" onClick={() => onEventClick?.(e)}
                    className="block w-full truncate rounded px-1 py-0.5 text-left text-xs text-white"
                    style={{ background: e.color ?? "var(--color-primary)" }} title={e.title}>
                    {e.allDay ? "" : `${String(e.start.getHours()).padStart(2, "0")}:${String(e.start.getMinutes()).padStart(2, "0")} `}{e.title}
                  </button>
                ))}
                {dayEvents.length > MAX && (
                  <button type="button" onClick={() => onDateClick?.(cell.date)} className="px-1 text-xs text-[var(--color-muted)] hover:underline">
                    他 {dayEvents.length - MAX} 件
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** 時間グリッド(週=7日 / 日=1日)。 */
function TimeGridView({ days, events, dayStartHour, dayEndHour, onEventClick, onDateClick }: {
  days: Date[]; events: CalendarEvent[]; dayStartHour: number; dayEndHour: number;
  onEventClick?: (e: CalendarEvent) => void; onDateClick?: (d: Date) => void;
}) {
  const hours = Array.from({ length: dayEndHour - dayStartHour }, (_, i) => dayStartHour + i);
  const HOUR_PX = 48;
  const totalTop = dayStartHour / 24;
  const visibleFrac = (dayEndHour - dayStartHour) / 24;
  return (
    <div className="flex flex-1 flex-col overflow-auto">
      {/* 曜日ヘッダ */}
      <div className="sticky top-0 z-10 flex border-b border-[var(--color-border)] bg-[var(--color-bg)]">
        <div className="w-14 shrink-0" />
        {days.map((d, i) => {
          const today = new Date(); const isToday = d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
          return (
            <button key={i} type="button" onClick={() => onDateClick?.(d)} className="flex-1 py-2 text-center text-xs hover:bg-slate-50">
              <div className="text-[var(--color-muted)]">{weekdayJa(d)}</div>
              <div className={cn("mx-auto flex h-6 w-6 items-center justify-center rounded-full", isToday && "bg-[var(--color-primary)] font-semibold text-[var(--color-primary-fg)]")}>{d.getDate()}</div>
            </button>
          );
        })}
      </div>
      {/* 終日行 */}
      <div className="flex border-b border-[var(--color-border)]">
        <div className="w-14 shrink-0 py-1 text-right text-[10px] text-[var(--color-muted)]">終日</div>
        {days.map((d, i) => (
          <div key={i} className="min-h-[1.5rem] flex-1 space-y-0.5 border-l border-[var(--color-border)] p-0.5">
            {eventsForDay(events, d).filter((e) => e.allDay).map((e) => (
              <button key={e.id} type="button" onClick={() => onEventClick?.(e)} className="block w-full truncate rounded px-1 text-left text-xs text-white" style={{ background: e.color ?? "var(--color-primary)" }}>{e.title}</button>
            ))}
          </div>
        ))}
      </div>
      {/* 時間グリッド */}
      <div className="flex flex-1">
        <div className="w-14 shrink-0">
          {hours.map((h) => <div key={h} style={{ height: HOUR_PX }} className="relative -top-2 pr-1 text-right text-[10px] text-[var(--color-muted)]">{h}:00</div>)}
        </div>
        {days.map((d, di) => {
          const positioned = layoutDayEvents(events, d);
          const colHeight = hours.length * HOUR_PX;
          return (
            <div key={di} className="relative flex-1 border-l border-[var(--color-border)]" style={{ height: colHeight }}>
              {hours.map((h) => <div key={h} style={{ height: HOUR_PX }} className="border-b border-[var(--color-border)]" />)}
              {(() => {
                const off = nowOffset(d);
                if (off === null) return null;
                const y = ((off - totalTop) / visibleFrac) * colHeight;
                if (y < 0 || y > colHeight) return null;
                return (
                  <div className="pointer-events-none absolute left-0 right-0 z-20 flex items-center" style={{ top: y }} aria-hidden>
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                    <span className="h-px flex-1 bg-red-500" />
                  </div>
                );
              })()}
              {positioned.map((p) => {
                const top = ((p.top - totalTop) / visibleFrac) * colHeight;
                const height = (p.height / visibleFrac) * colHeight;
                const width = 100 / p.columns;
                return (
                  <button key={p.event.id} type="button" onClick={() => onEventClick?.(p.event)}
                    className="absolute overflow-hidden rounded px-1 text-left text-xs text-white shadow-sm"
                    style={{ top, height: Math.max(height, 14), left: `${p.column * width}%`, width: `calc(${width}% - 2px)`, background: p.event.color ?? "var(--color-primary)" }}
                    title={`${formatEventTime(p.event)} ${p.event.title}`}>
                    <span className="font-medium">{p.event.title}</span>
                    <span className="block opacity-90">{formatEventTime(p.event)}</span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** 予定リスト(アジェンダ)。 */
function AgendaView({ events, onEventClick, onDateClick }: {
  events: CalendarEvent[]; onEventClick?: (e: CalendarEvent) => void; onDateClick?: (d: Date) => void;
}) {
  const groups = groupEventsByDay(events);
  if (groups.length === 0) return <div className="p-8 text-center text-sm text-[var(--color-muted)]">予定はありません</div>;
  return (
    <div className="divide-y divide-[var(--color-border)]">
      {groups.map((g, i) => (
        <div key={i} className="flex gap-4 p-3">
          <button type="button" onClick={() => onDateClick?.(g.date)} className="w-24 shrink-0 text-left">
            <div className="text-sm font-semibold">{g.date.getMonth() + 1}月{g.date.getDate()}日</div>
            <div className={cn("text-xs", isHoliday(g.date) || g.date.getDay() === 0 ? "text-red-500" : g.date.getDay() === 6 ? "text-sky-600" : "text-[var(--color-muted)]")}>{weekdayJa(g.date)}{holidayName(g.date) ? ` ${holidayName(g.date)}` : ""}</div>
          </button>
          <ul className="flex-1 space-y-1">
            {g.events.map((e) => (
              <li key={e.id}>
                <button type="button" onClick={() => onEventClick?.(e)} className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-slate-50">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: e.color ?? "var(--color-primary)" }} />
                  <span className="w-24 shrink-0 text-xs text-[var(--color-muted)]">{formatEventTime(e)}</span>
                  <span className="min-w-0 flex-1 truncate">{e.title}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
