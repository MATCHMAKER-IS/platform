"use client";
/**
 * 通知ベル。未読バッジ付きのベルアイコンと、クリックで開く通知一覧のドロップダウン。
 * ヘッダー右端に置く想定。通知は今日/昨日/それ以前でグループ表示する。
 * @packageDocumentation
 */
import * as React from "react";
import { Bell } from "lucide-react";
import { cn } from "../lib/cn.js";
import { type AppNotification, unreadCount, groupByDate } from "../lib/notifications.js";

/** {@link NotificationBell} の props。 */
export interface NotificationBellProps {
  notifications: AppNotification[];
  /** 通知クリック時(href が無い場合の遷移や既読化)。 */
  onNotificationClick?: (n: AppNotification) => void;
  /** 「すべて既読」クリック時。 */
  onMarkAllRead?: () => void;
  /** 「すべて見る」の遷移先。 */
  viewAllHref?: string;
  className?: string;
}

const GROUP_LABELS: { key: "today" | "yesterday" | "earlier"; label: string }[] = [
  { key: "today", label: "今日" },
  { key: "yesterday", label: "昨日" },
  { key: "earlier", label: "それ以前" },
];

/** ヘッダー用の通知ベル。 */
export function NotificationBell({ notifications, onNotificationClick, onMarkAllRead, viewAllHref, className }: NotificationBellProps) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const unread = unreadCount(notifications);
  const groups = groupByDate(notifications);

  React.useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        aria-label={unread > 0 ? `通知 ${unread}件の未読` : "通知"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius)] text-[var(--color-fg)] transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
      >
        <Bell size={18} aria-hidden="true" />
        {unread > 0 && (
          <span className="absolute right-1.5 top-1.5 inline-flex min-w-4 items-center justify-center rounded-full bg-[var(--color-danger)] px-1 text-[10px] font-medium leading-4 text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div role="menu" className="absolute right-0 z-40 mt-1 w-80 overflow-hidden rounded-[var(--radius)] border border-[var(--color-border)] bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-2.5">
            <span className="text-sm font-semibold text-[var(--color-fg)]">通知</span>
            {unread > 0 && onMarkAllRead && (
              <button type="button" onClick={onMarkAllRead} className="text-xs text-[var(--color-primary)] hover:underline">すべて既読</button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-[var(--color-muted)]">通知はありません</p>
            ) : (
              GROUP_LABELS.filter((g) => groups[g.key].length > 0).map((g) => (
                <div key={g.key}>
                  <div className="bg-slate-50 px-4 py-1.5 text-xs font-medium text-[var(--color-muted)]">{g.label}</div>
                  <ul>
                    {groups[g.key].map((n) => {
                      const inner = (
                        <div className={cn("flex gap-3 px-4 py-3 transition-colors hover:bg-slate-50", !n.read && "bg-blue-50/50")}>
                          {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--color-primary)]" aria-hidden="true" />}
                          <div className={cn("min-w-0 flex-1", n.read && "pl-5")}>
                            <p className="truncate text-sm font-medium text-[var(--color-fg)]">{n.title}</p>
                            {n.body != null && <p className="mt-0.5 line-clamp-2 text-xs text-[var(--color-muted)]">{n.body}</p>}
                          </div>
                        </div>
                      );
                      return (
                        <li key={n.id}>
                          {n.href ? (
                            <a href={n.href} onClick={() => { setOpen(false); onNotificationClick?.(n); }}>{inner}</a>
                          ) : (
                            <button type="button" className="block w-full text-left" onClick={() => { onNotificationClick?.(n); }}>{inner}</button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))
            )}
          </div>

          {viewAllHref && (
            <a href={viewAllHref} className="block border-t border-[var(--color-border)] px-4 py-2.5 text-center text-sm text-[var(--color-primary)] hover:bg-slate-50" onClick={() => setOpen(false)}>
              すべて見る
            </a>
          )}
        </div>
      )}
    </div>
  );
}
