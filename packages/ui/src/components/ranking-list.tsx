"use client";
/**
 * ランキングリスト。上位項目を順位・値・インラインバーで表示する(売上上位商品など)。
 * @packageDocumentation
 */
import { cn } from "../lib/cn";

/** ランキングの 1 項目。 */
export interface RankingItem {
  label: React.ReactNode;
  value: number;
}

/** {@link RankingList} の props。 */
export interface RankingListProps {
  items: RankingItem[];
  /** 表示する最大件数。 */
  limit?: number;
  /** 値の整形(既定は桁区切り)。 */
  format?: (n: number) => string;
  /** バーの色。 */
  barColor?: string;
  className?: string;
}

const defaultFormat = (n: number) => n.toLocaleString("ja-JP");

/** ランキングリスト。値の降順に順位・バー・値を表示する。 */
/**
 * 順位の一覧。
 *
 * 上位だけでなく、**自分がどこにいるか**を示せると使われる。
 * 人を順位付けするときは、目的と見せる範囲を先に決める。
 */
export function RankingList({ items, limit, format = defaultFormat, barColor = "var(--color-primary)", className }: RankingListProps) {
  const sorted = [...items].sort((a, b) => b.value - a.value).slice(0, limit ?? items.length);
  const max = sorted[0]?.value ?? 0;
  return (
    <ol className={cn("space-y-2", className)}>
      {sorted.map((item, i) => (
        <li key={i} className="flex items-center gap-3">
          <span className={cn("w-5 shrink-0 text-right text-sm font-semibold tabular-nums", i < 3 ? "text-[var(--color-fg)]" : "text-[var(--color-muted)]")}>{i + 1}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-sm">{item.label}</span>
              <span className="shrink-0 text-sm font-medium tabular-nums">{format(item.value)}</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--color-border)]/40">
              <div className="h-full rounded-full" style={{ width: max > 0 ? `${(item.value / max) * 100}%` : "0%", background: barColor }} />
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
