/**
 * 共通 DescriptionList。項目名と値の組を並べる詳細表示(申請詳細・従業員情報など)。
 * @packageDocumentation
 */
import * as React from "react";
import { cn } from "../lib/cn";

/** 1 項目(項目名と値)。 */
export interface DescriptionItem {
  label: React.ReactNode;
  value: React.ReactNode;
  /** 値を全幅で表示する(長文・表など)。 */
  full?: boolean;
}

/** {@link DescriptionList} の props。 */
export interface DescriptionListProps extends React.HTMLAttributes<HTMLDListElement> {
  items: DescriptionItem[];
  /** 列数(既定 1。2 で 2 カラム)。 */
  columns?: 1 | 2;
  /** 罫線で区切る。 */
  divided?: boolean;
}

/** 項目名:値 の詳細リスト。columns=2 で 2 カラム、divided で行区切り。 */
export function DescriptionList({ items, columns = 1, divided = false, className, ...props }: DescriptionListProps) {
  return (
    <dl
      className={cn(
        "text-sm",
        columns === 2 ? "grid grid-cols-1 gap-x-8 sm:grid-cols-2" : "grid grid-cols-1",
        divided ? "" : "gap-y-3",
        className,
      )}
      {...props}
    >
      {items.map((item, i) => (
        <div
          key={i}
          className={cn(
            "grid grid-cols-[minmax(6rem,10rem)_1fr] gap-x-4 py-2",
            divided && "border-b border-[var(--color-border)] last:border-0",
            item.full && "col-span-full",
          )}
        >
          <dt className="font-medium text-[var(--color-muted)]">{item.label}</dt>
          <dd className="min-w-0 break-words text-[var(--color-fg)]">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
