/**
 * カレンダーのカテゴリ凡例。色と名称を並べ、クリックで表示/非表示の切替もできる。
 * @packageDocumentation
 */
import * as React from "react";
import { cn } from "../lib/cn";

/** 凡例の 1 カテゴリ。 */
export interface CalendarCategory {
  id: string;
  label: React.ReactNode;
  color: string;
}

/** {@link CalendarLegend} の props。 */
export interface CalendarLegendProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onToggle"> {
  categories: CalendarCategory[];
  /** 非表示中のカテゴリ ID(制御)。 */
  hiddenIds?: string[];
  /** カテゴリのクリック(表示/非表示切替)。 */
  onToggle?: (id: string) => void;
}

/** カテゴリ凡例。onToggle を渡すとフィルタ UI として使える。 */
export function CalendarLegend({ categories, hiddenIds = [], onToggle, className, ...props }: CalendarLegendProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-1.5", className)} {...props}>
      {categories.map((c) => {
        const hidden = hiddenIds.includes(c.id);
        const Cmp: React.ElementType = onToggle ? "button" : "span";
        return (
          <Cmp
            key={c.id}
            {...(onToggle ? { type: "button", onClick: () => onToggle(c.id) } : {})}
            className={cn("inline-flex items-center gap-1.5 text-sm", onToggle && "cursor-pointer", hidden && "opacity-40")}
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} aria-hidden />
            <span className={cn(hidden && "line-through")}>{c.label}</span>
          </Cmp>
        );
      })}
    </div>
  );
}
