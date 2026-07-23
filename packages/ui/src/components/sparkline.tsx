"use client";
/**
 * スパークライン(依存なし・SVG)。小さな折れ線で傾向を表示する。
 * @packageDocumentation
 */
import { cn } from "../lib/cn";

/** {@link Sparkline} の props。 */
export interface SparklineProps {
  values: number[];
  width?: number;
  height?: number;
  strokeWidth?: number;
  /** 面塗り。 */
  showArea?: boolean;
  /** 最終点にドット。 */
  showLastDot?: boolean;
  className?: string;
}

/** スパークライン。色は currentColor に従う。 */
/**
 * 極小の折れ線(数値の横に置く推移)。
 *
 * **傾向だけを見せる**もの。目盛りが無いので、正確な値は別に出す。
 * 表の 1 列や `KpiCard` の中に置くと、数字だけより変化が伝わる。
 */
export function Sparkline({ values, width = 120, height = 32, strokeWidth = 1.5, showArea = false, showLastDot = false, className }: SparklineProps) {
  if (values.length === 0) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pad = strokeWidth;
  const h = height - pad * 2;
  const step = values.length > 1 ? width / (values.length - 1) : 0;
  const pts = values.map((v, i) => [i * step, pad + h - ((v - min) / range) * h] as const);
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1]!;
  return (
    <svg width={width} height={height} className={cn("text-[var(--color-primary)]", className)} viewBox={`0 0 ${width} ${height}`}>
      {showArea && <polygon points={`0,${height} ${line} ${(values.length - 1) * step},${height}`} fill="currentColor" opacity={0.12} />}
      <polyline points={line} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" />
      {showLastDot && <circle cx={last[0]} cy={last[1]} r={strokeWidth + 1} fill="currentColor" />}
    </svg>
  );
}
