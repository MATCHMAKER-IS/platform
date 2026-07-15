"use client";
/**
 * 散布図(SVG)。任意で回帰直線と相関係数を表示する。
 * @packageDocumentation
 */
import { linearRegressionXY, correlation } from "@platform/utils";
import { cn } from "../lib/cn.js";

/** 散布図の点。 */
export interface ScatterPoint { x: number; y: number }

/** {@link Scatter} の props。 */
export interface ScatterProps {
  points: ScatterPoint[];
  width?: number;
  height?: number;
  /** 回帰直線を表示。 */
  showRegression?: boolean;
  /** 相関係数を表示。 */
  showCorrelation?: boolean;
  className?: string;
}

/** 散布図。 */
export function Scatter({ points, width = 320, height = 200, showRegression = false, showCorrelation = false, className }: ScatterProps) {
  if (points.length === 0) return null;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMin = Math.min(...ys), yMax = Math.max(...ys);
  const xSpan = xMax - xMin || 1, ySpan = yMax - yMin || 1;
  const pad = 8;
  const sx = (x: number) => pad + ((x - xMin) / xSpan) * (width - pad * 2);
  const sy = (y: number) => height - pad - ((y - yMin) / ySpan) * (height - pad * 2);

  const fit = showRegression ? linearRegressionXY(xs, ys) : null;
  const r = showCorrelation ? correlation(xs, ys) : NaN;

  return (
    <div className={cn("inline-block", className)}>
      <svg width={width} height={height} className="text-[var(--color-primary)]" viewBox={`0 0 ${width} ${height}`}>
        <rect x={0} y={0} width={width} height={height} fill="none" stroke="var(--color-border)" strokeWidth={1} />
        {fit && Number.isFinite(fit.slope) && (
          <line x1={sx(xMin)} y1={sy(fit.slope * xMin + fit.intercept)} x2={sx(xMax)} y2={sy(fit.slope * xMax + fit.intercept)} stroke="currentColor" strokeWidth={1.5} opacity={0.6} strokeDasharray="4 3" />
        )}
        {points.map((p, i) => <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r={3} fill="currentColor" opacity={0.7} />)}
      </svg>
      {showCorrelation && Number.isFinite(r) && <div className="mt-1 text-xs text-[var(--color-muted)]">相関係数 r = {r.toFixed(3)}</div>}
    </div>
  );
}
