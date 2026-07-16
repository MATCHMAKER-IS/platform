/**
 * 共通 Block / BlockGrid。カテゴリタイルやメニューなどの密なブロック表示(グリッド)。
 * @packageDocumentation
 */
import * as React from "react";
import { cn } from "../lib/cn";

/** {@link BlockGrid} の props。 */
export interface BlockGridProps extends React.HTMLAttributes<HTMLDivElement> {
  /** ブロック最小幅(px)。既定 140。 */
  minWidth?: number;
  /** 間隔(px)。既定 12。 */
  gap?: number;
}
/** ブロックを敷き詰めるグリッド(ブロック表示)。 */
export function BlockGrid({ minWidth = 140, gap = 12, className, style, ...props }: BlockGridProps) {
  return (
    <div
      className={cn("grid", className)}
      style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${minWidth}px, 1fr))`, gap, ...style }}
      {...props}
    />
  );
}

/** {@link Block} の props。 */
export interface BlockProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 上部のアイコン等。 */
  icon?: React.ReactNode;
  /** ラベル。 */
  label?: React.ReactNode;
  /** クリック時(指定でホバー効果)。 */
  onSelect?: () => void;
  /** 選択状態。 */
  selected?: boolean;
}
/** 正方形寄りのブロックタイル。 */
export function Block({ icon, label, onSelect, selected, className, children, ...props }: BlockProps) {
  return (
    <div
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onClick={onSelect}
      onKeyDown={onSelect ? (e: React.KeyboardEvent) => (e.key === "Enter" || e.key === " ") && onSelect() : undefined}
      className={cn(
        "flex aspect-square flex-col items-center justify-center gap-2 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-center text-sm",
        onSelect && "cursor-pointer transition-colors hover:border-[var(--color-primary)] hover:bg-slate-50",
        selected && "border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]",
        className,
      )}
      {...props}
    >
      {children ?? (
        <>
          {icon != null && <span className="text-[var(--color-primary)]">{icon}</span>}
          {label != null && <span className="line-clamp-2 font-medium">{label}</span>}
        </>
      )}
    </div>
  );
}
