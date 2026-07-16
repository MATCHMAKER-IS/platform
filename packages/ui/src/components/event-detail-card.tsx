/**
 * イベント詳細カード。Popover / Dialog の中身として使う予定の詳細表示。
 * カレンダーのイベントをクリックしたときの「予定の中身」を整形する。
 * @packageDocumentation
 */
import * as React from "react";
import { Clock, MapPin, Tag, X } from "lucide-react";
import { cn } from "../lib/cn";
import { type CalendarEvent, formatEventTime } from "../lib/schedule";

/** {@link EventDetailCard} の props。 */
export interface EventDetailCardProps extends React.HTMLAttributes<HTMLDivElement> {
  event: CalendarEvent;
  /** 日付表示(例 "7月25日(金)")。 */
  dateLabel?: React.ReactNode;
  /** 場所(会議室名など)。 */
  location?: React.ReactNode;
  /** カテゴリ名(色は event.color)。 */
  categoryLabel?: React.ReactNode;
  /** 説明文。 */
  description?: React.ReactNode;
  /** 閉じるボタン押下時。 */
  onClose?: () => void;
  /** 追加のアクション(編集ボタン等)。 */
  actions?: React.ReactNode;
}

/** 予定詳細カード。時刻・場所・カテゴリ・説明を整形表示。 */
export function EventDetailCard({ event, dateLabel, location, categoryLabel, description, onClose, actions, className, ...props }: EventDetailCardProps) {
  return (
    <div className={cn("w-72 text-sm", className)} {...props}>
      <div className="mb-2 flex items-start gap-2">
        <span className="mt-1 h-3 w-3 shrink-0 rounded-sm" style={{ background: event.color ?? "var(--color-primary)" }} aria-hidden />
        <h3 className="min-w-0 flex-1 font-semibold leading-snug">{event.title}</h3>
        {onClose && (
          <button type="button" aria-label="閉じる" onClick={onClose} className="shrink-0 text-[var(--color-muted)] hover:text-[var(--color-fg)]">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <dl className="space-y-1.5 text-[var(--color-muted)]">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 shrink-0" aria-hidden />
          <span>{dateLabel ? <>{dateLabel} · </> : null}{formatEventTime(event)}</span>
        </div>
        {location && (
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 shrink-0" aria-hidden />
            <span className="min-w-0 truncate">{location}</span>
          </div>
        )}
        {categoryLabel && (
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 shrink-0" aria-hidden />
            <span>{categoryLabel}</span>
          </div>
        )}
      </dl>
      {description && <p className="mt-2 whitespace-pre-wrap text-[var(--color-fg)]">{description}</p>}
      {actions && <div className="mt-3 flex justify-end gap-2">{actions}</div>}
    </div>
  );
}
