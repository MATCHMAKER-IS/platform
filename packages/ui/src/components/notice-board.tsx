/**
 * 共通 NoticeBoard。ダッシュボードのお知らせ一覧(社内連絡・システム通知など)。
 * @packageDocumentation
 */
import * as React from "react";
import { cn } from "../lib/cn";

/** お知らせの重要度。 */
export type NoticeLevel = "info" | "important" | "warning" | "success";

/** お知らせ 1 件。 */
export interface NoticeItem {
  id: string;
  title: React.ReactNode;
  /** 日付等のメタ。 */
  date?: React.ReactNode;
  /** カテゴリ(例: "人事", "システム")。 */
  category?: React.ReactNode;
  level?: NoticeLevel;
  /** 未読。 */
  unread?: boolean;
  /** クリック時(詳細へ)。 */
  onClick?: () => void;
  href?: string;
}

/** {@link NoticeBoard} の props。 */
export interface NoticeBoardProps extends React.HTMLAttributes<HTMLElement> {
  items: NoticeItem[];
  /** 0 件時の表示。 */
  emptyText?: React.ReactNode;
}

const LEVEL_DOT: Record<NoticeLevel, string> = {
  info: "bg-sky-500", important: "bg-red-500", warning: "bg-amber-500", success: "bg-emerald-500",
};

/** お知らせ一覧。未読ドット・カテゴリ・日付を表示。 */
export function NoticeBoard({ items, emptyText = "お知らせはありません", className, ...props }: NoticeBoardProps) {
  if (items.length === 0) {
    return <div className={cn("px-4 py-8 text-center text-sm text-[var(--color-muted)]", className)} {...props}>{emptyText}</div>;
  }
  return (
    <ul className={cn("divide-y divide-[var(--color-border)]", className)} {...props}>
      {items.map((item) => {
        const Row: React.ElementType = item.href ? "a" : item.onClick ? "button" : "div";
        return (
          <li key={item.id}>
            <Row
              {...(item.href ? { href: item.href } : {})}
              {...(item.onClick ? { onClick: item.onClick, type: "button" } : {})}
              className={cn(
                "flex w-full items-start gap-3 px-3 py-2.5 text-left",
                (item.href || item.onClick) && "hover:bg-[var(--color-subtle)]",
              )}
            >
              <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", item.unread ? LEVEL_DOT[item.level ?? "info"] : "bg-transparent ring-1 ring-[var(--color-border)]")} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className={cn("truncate text-sm", item.unread ? "font-semibold text-[var(--color-fg)]" : "text-[var(--color-fg)]")}>{item.title}</span>
                  {item.category && <span className="rounded bg-[var(--color-subtle-strong)] px-1.5 py-0.5 text-xs text-[var(--color-muted)]">{item.category}</span>}
                </span>
                {item.date && <span className="mt-0.5 block text-xs text-[var(--color-muted)]">{item.date}</span>}
              </span>
            </Row>
          </li>
        );
      })}
    </ul>
  );
}
