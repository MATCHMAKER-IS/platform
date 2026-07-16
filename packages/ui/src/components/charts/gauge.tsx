"use client";
/** ゲージ(半円)と進捗リング(円)。SVGで自作。 @packageDocumentation */
import { cn } from "../../lib/cn";
import type { ReactNode } from "react";
import { arcPath, ringDashOffset } from "./chart-math";

/** {@link ProgressRing} の props。 */
export interface ProgressRingProps {
  value: number;
  max?: number;
  size?: number;
  stroke?: number;
  color?: string;
  trackColor?: string;
  /** 中央の表示(既定は %)。 */
  label?: ReactNode;
  className?: string;
}

/** 進捗リング(ドーナツ状の進捗)。 */
export function ProgressRing({ value, max = 100, size = 120, stroke = 12, color = "#0d9488", trackColor = "#e2e8f0", label, className }: ProgressRingProps) {
  const pct = Math.max(0, Math.min(1, value / max));
  const r = (size - stroke) / 2;
  const c = size / 2;
  const circumference = 2 * Math.PI * r;
  return (
    <div className={cn("inline-flex flex-col items-center", className)}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={c} cy={c} r={r} fill="none" stroke={trackColor} strokeWidth={stroke} />
        <circle
          cx={c} cy={c} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={ringDashOffset(pct, r)}
          transform={`rotate(-90 ${c} ${c})`}
        />
        <text x={c} y={c} textAnchor="middle" dominantBaseline="central" fontSize={size * 0.22} fontWeight={700} fill="var(--color-fg)">
          {label ?? `${Math.round(pct * 100)}%`}
        </text>
      </svg>
    </div>
  );
}

/** {@link Gauge} の props。 */
export interface GaugeProps {
  value: number;
  min?: number;
  max?: number;
  size?: number;
  stroke?: number;
  color?: string;
  trackColor?: string;
  unit?: string;
  className?: string;
}

/** 半円ゲージ(スピードメータ風)。 */
export function Gauge({ value, min = 0, max = 100, size = 180, stroke = 16, color = "#0d9488", trackColor = "#e2e8f0", unit, className }: GaugeProps) {
  const pct = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const startAngle = -90;
  const endAngle = 90;
  const valueAngle = startAngle + (endAngle - startAngle) * pct;
  return (
    <div className={cn("inline-flex flex-col items-center", className)}>
      <svg width={size} height={size / 2 + stroke} viewBox={`0 0 ${size} ${size / 2 + stroke}`}>
        <path d={arcPath(cx, cy, r, startAngle, endAngle)} fill="none" stroke={trackColor} strokeWidth={stroke} strokeLinecap="round" />
        <path d={arcPath(cx, cy, r, startAngle, valueAngle)} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" />
        <text x={cx} y={cy - stroke / 2} textAnchor="middle" fontSize={size * 0.16} fontWeight={700} fill="var(--color-fg)">
          {value}{unit}
        </text>
      </svg>
    </div>
  );
}
