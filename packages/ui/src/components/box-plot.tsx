"use client";
/**
 * 箱ひげ図(SVG)。四分位・ひげ(1.5 IQR)・外れ値を表示する。
 * @packageDocumentation
 */
import { quartiles, outlierBounds, outliers, min as fnMin, max as fnMax } from "@platform/utils";
import { cn } from "../lib/cn.js";

/** {@link BoxPlot} の props。 */
export interface BoxPlotProps {
  values: number[];
  width?: number;
  height?: number;
  /** 表示範囲(既定はデータの min/max に余白)。 */
  domain?: [number, number];
  outlierK?: number;
  className?: string;
}

/** 箱ひげ図。 */
export function BoxPlot({ values, width = 320, height = 64, domain, outlierK = 1.5, className }: BoxPlotProps) {
  if (values.length === 0) return null;
  const q = quartiles(values);
  const { lower, upper } = outlierBounds(values, outlierK);
  const out = outliers(values, outlierK);
  const inliers = values.filter((v) => v >= lower && v <= upper);
  const whiskLo = inliers.length ? fnMin(inliers) : q.q1;
  const whiskHi = inliers.length ? fnMax(inliers) : q.q3;

  const [dMin, dMax] = domain ?? [fnMin(values), fnMax(values)];
  const span = dMax - dMin || 1;
  const x = (v: number) => ((v - dMin) / span) * (width - 8) + 4;
  const cy = height / 2;
  const boxH = Math.min(28, height - 16);
  const boxTop = cy - boxH / 2;

  return (
    <svg width={width} height={height} className={cn("text-[var(--color-primary)]", className)} viewBox={`0 0 ${width} ${height}`}>
      {/* whisker line */}
      <line x1={x(whiskLo)} y1={cy} x2={x(whiskHi)} y2={cy} stroke="currentColor" strokeWidth={1} opacity={0.5} />
      <line x1={x(whiskLo)} y1={cy - 8} x2={x(whiskLo)} y2={cy + 8} stroke="currentColor" strokeWidth={1} />
      <line x1={x(whiskHi)} y1={cy - 8} x2={x(whiskHi)} y2={cy + 8} stroke="currentColor" strokeWidth={1} />
      {/* box */}
      <rect x={x(q.q1)} y={boxTop} width={Math.max(1, x(q.q3) - x(q.q1))} height={boxH} fill="currentColor" opacity={0.15} stroke="currentColor" strokeWidth={1} />
      {/* median */}
      <line x1={x(q.median)} y1={boxTop} x2={x(q.median)} y2={boxTop + boxH} stroke="currentColor" strokeWidth={2} />
      {/* outliers */}
      {out.map((v, i) => <circle key={i} cx={x(v)} cy={cy} r={2.5} fill="var(--color-danger)" />)}
    </svg>
  );
}
