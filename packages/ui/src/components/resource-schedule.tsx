"use client";
/**
 * リソース横並びスケジュール(会議室・担当者・設備を列で並べる 1 日ビュー)。
 * 各リソース列は独立に重なりを列分割する。読み取り専用でクリックはコールバックで受ける。
 * @packageDocumentation
 */
import * as React from "react";
import { cn } from "../lib/cn.js";
import {
  type CalendarEvent, type CalendarResource, layoutResourceDay, nowOffset, formatEventTime,
} from "../lib/schedule.js";

/** {@link ResourceSchedule} の props。 */
export interface ResourceScheduleProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 表示日。 */
  date: Date;
  /** 横に並べるリソース(会議室など)。 */
  resources: CalendarResource[];
  /** イベント(resourceId でリソースに割り当て)。 */
  events: CalendarEvent[];
  /** 表示開始/終了時(既定 8..20)。 */
  dayStartHour?: number;
  dayEndHour?: number;
  /** イベントクリック。 */
  onEventClick?: (event: CalendarEvent) => void;
}

/** リソース横並び 1 日スケジュール。 */
export function ResourceSchedule({ date, resources, events, dayStartHour = 8, dayEndHour = 20, onEventClick, className, ...props }: ResourceScheduleProps) {
  const hours = Array.from({ length: dayEndHour - dayStartHour }, (_, i) => dayStartHour + i);
  const HOUR_PX = 44;
  const colHeight = hours.length * HOUR_PX;
  const totalTop = dayStartHour / 24;
  const visibleFrac = (dayEndHour - dayStartHour) / 24;
  const layout = layoutResourceDay(events, resources, date);
  const off = nowOffset(date);
  const nowY = off === null ? null : ((off - totalTop) / visibleFrac) * colHeight;

  return (
    <div className={cn("overflow-auto rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)]", className)} {...props}>
      {/* リソース見出し */}
      <div className="sticky top-0 z-10 flex border-b border-[var(--color-border)] bg-[var(--color-bg)]">
        <div className="w-14 shrink-0" />
        {resources.map((r) => (
          <div key={r.id} className="flex flex-1 items-center justify-center gap-1.5 border-l border-[var(--color-border)] py-2 text-sm font-medium">
            {r.color && <span className="h-2.5 w-2.5 rounded-full" style={{ background: r.color }} aria-hidden />}
            <span className="truncate">{r.label}</span>
          </div>
        ))}
      </div>
      {/* 終日行 */}
      <div className="flex border-b border-[var(--color-border)]">
        <div className="w-14 shrink-0 py-1 text-right text-[10px] text-[var(--color-muted)]">終日</div>
        {layout.map(({ resource, allDay }) => (
          <div key={resource.id} className="min-h-[1.5rem] flex-1 space-y-0.5 border-l border-[var(--color-border)] p-0.5">
            {allDay.map((e) => (
              <button key={e.id} type="button" onClick={() => onEventClick?.(e)} className="block w-full truncate rounded px-1 text-left text-xs text-white" style={{ background: e.color ?? resource.color ?? "var(--color-primary)" }}>{e.title}</button>
            ))}
          </div>
        ))}
      </div>
      {/* 時間グリッド */}
      <div className="flex">
        <div className="w-14 shrink-0">
          {hours.map((h) => <div key={h} style={{ height: HOUR_PX }} className="relative -top-2 pr-1 text-right text-[10px] text-[var(--color-muted)]">{h}:00</div>)}
        </div>
        {layout.map(({ resource, positioned }) => (
          <div key={resource.id} className="relative flex-1 border-l border-[var(--color-border)]" style={{ height: colHeight }}>
            {hours.map((h) => <div key={h} style={{ height: HOUR_PX }} className="border-b border-[var(--color-border)]" />)}
            {nowY !== null && nowY >= 0 && nowY <= colHeight && (
              <div className="pointer-events-none absolute left-0 right-0 z-20 h-px bg-red-500" style={{ top: nowY }} aria-hidden />
            )}
            {positioned.map((p) => {
              const top = ((p.top - totalTop) / visibleFrac) * colHeight;
              const height = (p.height / visibleFrac) * colHeight;
              const width = 100 / p.columns;
              return (
                <button key={p.event.id} type="button" onClick={() => onEventClick?.(p.event)}
                  className="absolute overflow-hidden rounded px-1 text-left text-xs text-white shadow-sm"
                  style={{ top, height: Math.max(height, 14), left: `${p.column * width}%`, width: `calc(${width}% - 2px)`, background: p.event.color ?? resource.color ?? "var(--color-primary)" }}
                  title={`${formatEventTime(p.event)} ${p.event.title}`}>
                  <span className="font-medium">{p.event.title}</span>
                  <span className="block opacity-90">{formatEventTime(p.event)}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
