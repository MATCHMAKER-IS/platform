/**
 * 共通 ActivityTimeline。縦方向の履歴表示(承認フロー・監査ログ・変更履歴など)。
 * @packageDocumentation
 */
import * as React from "react";
import { cn } from "../lib/cn.js";

/** タイムラインの状態(色分け)。 */
export type TimelineStatus = "default" | "success" | "warning" | "danger" | "muted";

/** タイムラインの 1 項目。 */
export interface TimelineItem {
  /** 見出し(例: "承認: 田中部長")。 */
  title: React.ReactNode;
  /** 日時等のメタ表示。 */
  timestamp?: React.ReactNode;
  /** 補足説明。 */
  description?: React.ReactNode;
  /** 点の状態(色)。 */
  status?: TimelineStatus;
  /** 点の代わりに置くアイコン等。 */
  icon?: React.ReactNode;
}

/** {@link ActivityTimeline} の props。 */
export interface ActivityTimelineProps extends React.HTMLAttributes<HTMLOListElement> {
  items: TimelineItem[];
}

const DOT_COLOR: Record<TimelineStatus, string> = {
  default: "bg-[var(--color-primary)]",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
  muted: "bg-slate-300",
};

/** 縦型アクティビティ履歴。承認フローや変更履歴の表示に。 */
export function ActivityTimeline({ items, className, ...props }: ActivityTimelineProps) {
  return (
    <ol className={cn("relative ml-2", className)} {...props}>
      {items.map((item, i) => {
        const last = i === items.length - 1;
        return (
          <li key={i} className="relative flex gap-4 pb-6 last:pb-0">
            {!last && <span className="absolute left-[7px] top-4 h-full w-px bg-[var(--color-border)]" aria-hidden />}
            <span className="relative z-10 mt-1 flex h-4 w-4 shrink-0 items-center justify-center">
              {item.icon ?? <span className={cn("h-3 w-3 rounded-full ring-2 ring-[var(--color-bg)]", DOT_COLOR[item.status ?? "default"])} />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                <p className="font-medium text-[var(--color-fg)]">{item.title}</p>
                {item.timestamp && <time className="text-xs text-[var(--color-muted)]">{item.timestamp}</time>}
              </div>
              {item.description && <p className="mt-0.5 text-sm text-[var(--color-muted)]">{item.description}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
