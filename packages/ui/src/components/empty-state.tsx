/**
 * 共通 EmptyState。データが無いとき等の空状態表示。
 * リスト・テーブル・検索結果ゼロ件などで使う。
 * @packageDocumentation
 */
import * as React from "react";
import { Inbox } from "lucide-react";
import { cn } from "../lib/cn";

/** {@link EmptyState} の props。 */
export interface EmptyStateProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  /** アイコン(既定は受信トレイ)。 */
  icon?: React.ReactNode;
  /** 見出し(例: "データがありません")。 */
  title: React.ReactNode;
  /** 補足説明。 */
  description?: React.ReactNode;
  /** 行動を促すボタン等(例: 新規作成)。 */
  action?: React.ReactNode;
}

/**
 * 何も無いときに出す画面。
 *
 * **表を 0 行で見せない。** 「まだ何も無い」のか「絞り込みで消えた」のか
 * 「読み込みに失敗した」のかが分からないと、利用者は待つしかなくなる。
 *
 * | props | 使いどころ |
 * |---|---|
 * | `title` | 状況を一言で(「まだ申請がありません」) |
 * | `description` | 補足。**次にできること**を書く |
 * | `action` | 行動を促すボタン(「申請を作る」) |
 * | `icon` | 状況に合う絵柄。既定は受信トレイ |
 *
 * 絞り込みの結果が 0 件のときは、**条件を外す操作**を `action` に置くと親切。
 *
 * @example
 * ```tsx
 * <EmptyState title="まだ申請がありません" description="経費を使ったら、ここから申請します。"
 *   action={<Button onClick={create}>申請を作る</Button>} />
 *
 * // 絞り込みで 0 件になった場合
 * <EmptyState icon="🔍" title="条件に合う申請がありません"
 *   action={<Button variant="secondary" onClick={reset}>条件をすべて外す</Button>} />
 * ```
 */
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
