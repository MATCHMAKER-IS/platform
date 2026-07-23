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
  /** 範囲ドラッグ選択(月=日をまたぐドラッグ / 週・日=時間帯ドラッグ)。予定の新規作成に使う。 */
  onRangeSelect?: (start: Date, end: Date) => void;
  /** 予定を別の日へドラッグ移動したとき(月表示)。新しい開始/終了を返す。 */
  onEventDrop?: (event: CalendarEvent, newStart: Date, newEnd: Date) => void;
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
  events, view: viewProp, date: dateProp, onViewChange, onDateChange, onEventClick, onDateClick, onRangeSelect, onEventDrop,
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
          <button type="button" onClick={() => changeDate(new Date())} className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm hover:bg-[var(--color-subtle)]">今日</button>
          <button type="button" aria-label="前へ" onClick={() => move(-1)} className="rounded-md px-2 py-1.5 text-[var(--color-muted)] hover:bg-[var(--color-subtle-strong)]">‹</button>
          <button type="button" aria-label="次へ" onClick={() => move(1)} className="rounded-md px-2 py-1.5 text-[var(--color-muted)] hover:bg-[var(--color-subtle-strong)]">›</button>
          <span className="ml-1 text-base font-semibold">{title}</span>
        </div>
        <div className="inline-flex rounded-md border border-[var(--color-border)] p-0.5 text-sm">
          {([["month", "月"], ["week", "週"], ["day", "日"], ["agenda", "予定"]] as [CalendarView, string][]).map(([v, label]) => (
            <button key={v} type="button" onClick={() => changeView(v)}
              className={cn("rounded px-3 py-1", view === v ? "bg-[var(--color-primary)] text-[var(--color-primary-fg)]" : "text-[var(--color-fg)] hover:bg-[var(--color-subtle-strong)]")}>
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
      {view === "month" && <MonthView date={date} events={shownEvents} weekStartsOn={weekStartsOn} onEventClick={onEventClick} onDateClick={onDateClick} onRangeSelect={onRangeSelect} onEventDrop={onEventDrop} />}
      {view === "week" && <TimeGridView days={weekDays(date, weekStartsOn)} events={shownEvents} dayStartHour={dayStartHour} dayEndHour={dayEndHour} onEventClick={onEventClick} onDateClick={onDateClick} onRangeSelect={onRangeSelect} onEventDrop={onEventDrop} />}
      {view === "day" && <TimeGridView days={[startOfLocalDay(date)]} events={shownEvents} dayStartHour={dayStartHour} dayEndHour={dayEndHour} onEventClick={onEventClick} onDateClick={onDateClick} onRangeSelect={onRangeSelect} onEventDrop={onEventDrop} />}
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
function MonthView({ date, events, weekStartsOn, onEventClick, onDateClick, onRangeSelect, onEventDrop }: {
  date: Date; events: CalendarEvent[]; weekStartsOn: 0 | 1;
  onEventClick?: (e: CalendarEvent) => void; onDateClick?: (d: Date) => void; onRangeSelect?: (s: Date, e: Date) => void; onEventDrop?: (ev: CalendarEvent, ns: Date, ne: Date) => void;
}) {
  const grid = buildMonthGrid(date, { weekStartsOn });
  const flat = grid.flat();
  const head = weekStartsOn === 1 ? [...WEEK_HEAD_SUN.slice(1), WEEK_HEAD_SUN[0]!] : WEEK_HEAD_SUN;
  const MAX = 3;
  const [ds, setDs] = React.useState<number | null>(null);
  const [de, setDe] = React.useState<number | null>(null);
  const [moveEv, setMoveEv] = React.useState<{ ev: CalendarEvent; from: number } | null>(null);
  const [moveTo, setMoveTo] = React.useState<number | null>(null);
  const lo = ds !== null && de !== null ? Math.min(ds, de) : null;
  const hi = ds !== null && de !== null ? Math.max(ds, de) : null;
  const endDrag = () => {
    if (moveEv) {
      if (moveTo !== null && moveTo !== moveEv.from && onEventDrop) {
        const deltaMs = flat[moveTo]!.date.getTime() - flat[moveEv.from]!.date.getTime();
        onEventDrop(moveEv.ev, new Date(moveEv.ev.start.getTime() + deltaMs), new Date(moveEv.ev.end.getTime() + deltaMs));
      } else onEventClick?.(moveEv.ev);
      setMoveEv(null); setMoveTo(null); setDs(null); setDe(null); return;
    }
    if (onRangeSelect && ds !== null && de !== null) onRangeSelect(flat[Math.min(ds, de)]!.date, flat[Math.max(ds, de)]!.date);
    setDs(null); setDe(null);
  };
  const stop = (e: React.PointerEvent) => e.stopPropagation();
  return (
    <div className="flex flex-1 flex-col">
      <div className="grid grid-cols-7 border-b border-[var(--color-border)] text-center text-xs text-[var(--color-muted)]">
        {head.map((h, i) => <div key={i} className="py-1.5">{h}</div>)}
      </div>
      <div className="grid flex-1 auto-rows-fr grid-cols-7" style={{ touchAction: (onRangeSelect || onEventDrop) ? "none" : undefined }} onPointerUp={endDrag} onPointerLeave={() => { if (ds !== null || moveEv) endDrag(); }}>
        {flat.map((cell, i) => {
          const dayEvents = eventsForDay(events, cell.date);
          const hol = isHoliday(cell.date);
          const wd = cell.date.getDay();
          const inRange = lo !== null && hi !== null && i >= lo && i <= hi;
          return (
            <div key={i}
              onPointerDown={onRangeSelect ? () => { setDs(i); setDe(i); } : undefined}
              onPointerEnter={() => { if (ds !== null) setDe(i); if (moveEv) setMoveTo(i); }}
              style={{ boxShadow: (inRange || (moveEv !== null && moveTo === i)) ? "inset 0 0 0 2px var(--color-primary)" : undefined, cursor: onRangeSelect ? "cell" : undefined }}
              className={cn("min-h-[5rem] border-b border-r border-[var(--color-border)] p-1", !cell.inMonth && "bg-[var(--color-subtle)]/60")}>
              <button type="button" onPointerDown={stop} onClick={() => onDateClick?.(cell.date)}
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
                  <button key={e.id} type="button"
                    onPointerDown={(pe) => { pe.stopPropagation(); if (onEventDrop) { setMoveEv({ ev: e, from: i }); setMoveTo(i); } }}
                    onClick={() => { if (!onEventDrop) onEventClick?.(e); }}
                    className="block w-full truncate rounded px-1 py-0.5 text-left text-xs text-white"
                    style={{ background: e.color ?? "var(--color-primary)", cursor: onEventDrop ? "grab" : undefined }} title={e.title}>
                    {e.allDay ? "" : `${String(e.start.getHours()).padStart(2, "0")}:${String(e.start.getMinutes()).padStart(2, "0")} `}{e.title}
                  </button>
                ))}
                {dayEvents.length > MAX && (
                  <button type="button" onPointerDown={stop} onClick={() => onDateClick?.(cell.date)} className="px-1 text-xs text-[var(--color-muted)] hover:underline">
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
function TimeGridView({ days, events, dayStartHour, dayEndHour, onEventClick, onDateClick, onRangeSelect, onEventDrop }: {
  days: Date[]; events: CalendarEvent[]; dayStartHour: number; dayEndHour: number;
  onEventClick?: (e: CalendarEvent) => void; onDateClick?: (d: Date) => void; onRangeSelect?: (s: Date, e: Date) => void; onEventDrop?: (ev: CalendarEvent, ns: Date, ne: Date) => void;
}) {
  const hours = Array.from({ length: dayEndHour - dayStartHour }, (_, i) => dayStartHour + i);
  const HOUR_PX = 48;
  const totalTop = dayStartHour / 24;
  const visibleFrac = (dayEndHour - dayStartHour) / 24;
  const [tg, setTg] = React.useState<{ di: number; s: number; e: number } | null>(null);
  const [mev, setMev] = React.useState<{ id: string; di: number; startY: number; dy: number } | null>(null);
  const [rev, setRev] = React.useState<{ id: string; di: number; startY: number; dy: number; edge: "top" | "bottom" } | null>(null);
  const [adr, setAdr] = React.useState<{ from: number; to: number } | null>(null);
  const endAdr = () => {
    if (adr && onRangeSelect) {
      const lo = Math.min(adr.from, adr.to), hi = Math.max(adr.from, adr.to);
      const a = days[lo]!, b = days[hi]!;
      onRangeSelect(new Date(a.getFullYear(), a.getMonth(), a.getDate(), 0, 0), new Date(b.getFullYear(), b.getMonth(), b.getDate(), 0, 0));
    }
    setAdr(null);
  };
  const endMove = () => {
    if (mev && onEventDrop) {
      const ev = events.find((e) => e.id === mev.id);
      if (ev) {
        const deltaHours = Math.round((mev.dy / HOUR_PX) * 2) / 2;
        if (deltaHours !== 0) onEventDrop(ev, new Date(ev.start.getTime() + deltaHours * 3600000), new Date(ev.end.getTime() + deltaHours * 3600000));
        else onEventClick?.(ev);
      }
    }
    setMev(null);
  };
  const endResize = () => {
    if (rev && onEventDrop) {
      const ev = events.find((e) => e.id === rev.id);
      if (ev) {
        const deltaHours = Math.round((rev.dy / HOUR_PX) * 2) / 2;
        if (deltaHours !== 0) {
          if (rev.edge === "bottom") onEventDrop(ev, ev.start, new Date(Math.max(ev.start.getTime() + 1800000, ev.end.getTime() + deltaHours * 3600000)));
          else onEventDrop(ev, new Date(Math.min(ev.end.getTime() - 1800000, ev.start.getTime() + deltaHours * 3600000)), ev.end);
        }
      }
    }
    setRev(null);
  };
  const hourAt = (el: HTMLElement, clientY: number) => {
    const rect = el.getBoundingClientRect();
    return dayStartHour + Math.max(0, Math.min(hours.length - 1, Math.floor((clientY - rect.top) / HOUR_PX)));
  };
  const endTg = () => {
    if (tg && onRangeSelect) {
      const d = days[tg.di]!; const s = Math.min(tg.s, tg.e); const e = Math.max(tg.s, tg.e) + 1;
      onRangeSelect(new Date(d.getFullYear(), d.getMonth(), d.getDate(), s, 0, 0), new Date(d.getFullYear(), d.getMonth(), d.getDate(), e, 0, 0));
    }
    setTg(null);
  };
  return (
    <div className="flex flex-1 flex-col overflow-auto">
      {/* 曜日ヘッダ */}
      <div className="sticky top-0 z-10 flex border-b border-[var(--color-border)] bg-[var(--color-bg)]">
        <div className="w-14 shrink-0" />
        {days.map((d, i) => {
          const today = new Date(); const isToday = d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
          return (
            <button key={i} type="button" onClick={() => onDateClick?.(d)} className="flex-1 py-2 text-center text-xs hover:bg-[var(--color-subtle)]">
              <div className="text-[var(--color-muted)]">{weekdayJa(d)}</div>
              <div className={cn("mx-auto flex h-6 w-6 items-center justify-center rounded-full", isToday && "bg-[var(--color-primary)] font-semibold text-[var(--color-primary-fg)]")}>{d.getDate()}</div>
            </button>
          );
        })}
      </div>
      {/* 終日行 */}
      <div className="flex border-b border-[var(--color-border)]" onPointerUp={onRangeSelect ? endAdr : undefined} onPointerLeave={onRangeSelect ? () => { if (adr) endAdr(); } : undefined}>
        <div className="w-14 shrink-0 py-1 text-right text-[10px] text-[var(--color-muted)]">終日</div>
        {days.map((d, i) => {
          const inR = adr !== null && i >= Math.min(adr.from, adr.to) && i <= Math.max(adr.from, adr.to);
          return (
            <div key={i}
              onPointerDown={onRangeSelect ? () => setAdr({ from: i, to: i }) : undefined}
              onPointerEnter={onRangeSelect ? () => { if (adr) setAdr({ from: adr.from, to: i }); } : undefined}
              style={{ touchAction: onRangeSelect ? "none" : undefined, cursor: onRangeSelect ? "cell" : undefined, boxShadow: inR ? "inset 0 0 0 2px var(--color-primary)" : undefined }}
              className="min-h-[1.5rem] flex-1 space-y-0.5 border-l border-[var(--color-border)] p-0.5">
            {eventsForDay(events, d).filter((e) => e.allDay).map((e) => (
              <button key={e.id} type="button" onPointerDown={(pe) => pe.stopPropagation()} onClick={() => onEventClick?.(e)} className="block w-full truncate rounded px-1 text-left text-xs text-white" style={{ background: e.color ?? "var(--color-primary)" }}>{e.title}</button>
            ))}
            </div>
          );
        })}
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
            <div key={di} className="relative flex-1 border-l border-[var(--color-border)]" style={{ height: colHeight, touchAction: (onRangeSelect || onEventDrop) ? "none" : undefined, cursor: onRangeSelect ? "cell" : undefined }}
              onPointerDown={onRangeSelect ? (ev) => { const h = hourAt(ev.currentTarget, ev.clientY); setTg({ di, s: h, e: h }); } : undefined}
              onPointerMove={(ev) => { if (rev && rev.di === di) setRev({ ...rev, dy: ev.clientY - rev.startY }); else if (mev && mev.di === di) setMev({ ...mev, dy: ev.clientY - mev.startY }); else if (tg && tg.di === di) { const h = hourAt(ev.currentTarget, ev.clientY); setTg({ di, s: tg.s, e: h }); } }}
              onPointerUp={() => { if (rev) endResize(); else if (mev) endMove(); else if (tg) endTg(); }}
              onPointerLeave={() => { if (rev && rev.di === di) endResize(); else if (mev && mev.di === di) endMove(); else if (tg && tg.di === di) endTg(); }}>
              {hours.map((h) => <div key={h} style={{ height: HOUR_PX }} className="border-b border-[var(--color-border)]" />)}
              {tg && tg.di === di && (
                <div className="pointer-events-none absolute left-0 right-0 z-10 rounded bg-[var(--color-primary)] opacity-30" style={{ top: (Math.min(tg.s, tg.e) - dayStartHour) * HOUR_PX, height: (Math.abs(tg.e - tg.s) + 1) * HOUR_PX }} />
              )}
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
                const rz = (rev && rev.id === p.event.id) ? rev : null;
                const evTop = rz && rz.edge === "top" ? top + rz.dy : top;
                const h = rz ? Math.max(14, rz.edge === "bottom" ? height + rz.dy : height - rz.dy) : Math.max(height, 14);
                return (
                  <button key={p.event.id} type="button"
                    onPointerDown={(pe) => { pe.stopPropagation(); if (onEventDrop) setMev({ id: p.event.id, di, startY: pe.clientY, dy: 0 }); }}
                    onClick={() => { if (!onEventDrop) onEventClick?.(p.event); }}
                    className="absolute overflow-hidden rounded px-1 text-left text-xs text-white shadow-sm"
                    style={{ top: evTop, height: h, left: `${p.column * width}%`, width: `calc(${width}% - 2px)`, background: p.event.color ?? "var(--color-primary)", transform: (mev && mev.id === p.event.id) ? `translateY(${mev.dy}px)` : undefined, cursor: onEventDrop ? "grab" : undefined, zIndex: ((mev && mev.id === p.event.id) || rz) ? 30 : undefined }}
                    title={`${formatEventTime(p.event)} ${p.event.title}`}>
                    <span className="font-medium">{p.event.title}</span>
                    <span className="block opacity-90">{formatEventTime(p.event)}</span>
                    {onEventDrop && (<>
                      <span onPointerDown={(pe) => { pe.stopPropagation(); setRev({ id: p.event.id, di, startY: pe.clientY, dy: 0, edge: "top" }); }} className="absolute inset-x-0 top-0" style={{ height: 7, cursor: "ns-resize" }} aria-hidden />
                      <span onPointerDown={(pe) => { pe.stopPropagation(); setRev({ id: p.event.id, di, startY: pe.clientY, dy: 0, edge: "bottom" }); }} className="absolute inset-x-0 bottom-0" style={{ height: 7, cursor: "ns-resize" }} aria-hidden />
                    </>)}
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
                <button type="button" onClick={() => onEventClick?.(e)} className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-[var(--color-subtle)]">
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
