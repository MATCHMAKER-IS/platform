"use client";
/**
 * メトリクスグリッド。KpiCard などを自動折り返しで並べるレイアウト。
 * @packageDocumentation
 */
import type { ReactNode } from "react";
import { cn } from "../lib/cn";

/** {@link MetricGrid} の props。 */
export interface MetricGridProps {
  children: ReactNode;
  /** カード最小幅(px)。既定 200。 */
  minWidth?: number;
  /** 間隔(rem)。既定 0.75。 */
  gap?: number;
  className?: string;
}

/** レスポンシブなメトリクスグリッド。 */
export function MetricGrid({ children, minWidth = 200, gap = 0.75, className }: MetricGridProps) {
  return (
    <div
      className={cn("grid", className)}
      style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${minWidth}px, 1fr))`, gap: `${gap}rem` }}
    >
      {children}
    </div>
  );
}
