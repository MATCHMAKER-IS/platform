/**
 * 共通 EmptyState。データが無いとき等の空状態表示。
 * リスト・テーブル・検索結果ゼロ件などで使う。
 * @packageDocumentation
 */
import * as React from "react";
import { Inbox } from "lucide-react";
import { cn } from "../lib/cn.js";

/** {@link EmptyState} の props。 */
export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  /** アイコン(既定は受信トレイ)。 */
  icon?: React.ReactNode;
  /** 見出し(例: "データがありません")。 */
  title: React.ReactNode;
  /** 補足説明。 */
  description?: React.ReactNode;
  /** 行動を促すボタン等(例: 新規作成)。 */
  action?: React.ReactNode;
}

/** 空状態。中央寄せでアイコン・見出し・説明・アクションを表示。 */
export function EmptyState({ className, icon, title, description, action, ...props }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 px-6 py-12 text-center", className)} {...props}>
      <div className="text-[var(--color-muted)]" aria-hidden>
        {icon ?? <Inbox className="h-10 w-10" />}
      </div>
      <div className="space-y-1">
        <p className="font-semibold text-[var(--color-fg)]">{title}</p>
        {description && <p className="text-sm text-[var(--color-muted)]">{description}</p>}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
