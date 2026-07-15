"use client";
/**
 * ゲージ(達成率メーター)。半円アークで value/target を表示する。
 * @packageDocumentation
 */
import { clamp } from "@platform/utils";
import { cn } from "../lib/cn.js";

/** {@link Gauge} の props。 */
export interface GaugeProps {
  value: number;
  /** 目標値(=100%)。既定 100。 */
  target?: number;
  size?: number;
  /** 中央ラベル(既定は達成率%)。 */
  label?: string;
  className?: string;
}

/** 達成率ゲージ(半円)。 */
export function Gauge({ value, target = 100, size = 120, label, className }: GaugeProps) {
  const ratio = clamp(target === 0 ? 0 : value / target, 0, 1);
  const r = size / 2 - 8;
  const cx = size / 2;
  const cy = size - 10;
  const circumference = Math.PI * r; // 半円
  const dash = circumference * ratio;
  const color = ratio >= 1 ? "text-green-600" : ratio >= 0.7 ? "text-[var(--color-primary)]" : "text-amber-500";
  const arc = (rr: number) => `M ${cx - rr} ${cy} A ${rr} ${rr} 0 0 1 ${cx + rr} ${cy}`;
  return (
    <div className={cn("inline-flex flex-col items-center", className)}>
      <svg width={size} height={size / 2 + 8} viewBox={`0 0 ${size} ${size / 2 + 8}`}>
        <path d={arc(r)} fill="none" stroke="currentColor" strokeWidth={8} className="text-[var(--color-muted)]/20" strokeLinecap="round" />
        <path d={arc(r)} fill="none" stroke="currentColor" strokeWidth={8} className={color} strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`} />
      </svg>
      <div className="-mt-4 text-lg font-bold tabular-nums">{label ?? `${Math.round(ratio * 100)}%`}</div>
    </div>
  );
}
