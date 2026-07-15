"use client";
/**
 * 内訳バー(構成比を 1 本の横棒で表す)。省スペースで割合を示す。
 * @packageDocumentation
 */
import { cn } from "../lib/cn.js";
import { computeShares } from "../lib/dashboard.js";

const PALETTE = ["#2563eb", "#16a34a", "#f59e0b", "#dc2626", "#7c3aed", "#0891b2"];

/** 内訳の 1 項目。 */
export interface BreakdownSegment {
  label: string;
  value: number;
  color?: string;
}

/** {@link BreakdownBar} の props。 */
export interface BreakdownBarProps {
  data: BreakdownSegment[];
  /** バーの高さ(px)。 */
  height?: number;
  /** ラベル・割合の凡例を下に表示。 */
  showLegend?: boolean;
  className?: string;
}

/** 内訳バー。構成比を色分けした 1 本の横棒で表示する。 */
export function BreakdownBar({ data, height = 12, showLegend = true, className }: BreakdownBarProps) {
  if (data.length === 0) return null;
  const shares = computeShares(data.map((d) => d.value));
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex overflow-hidden rounded-full" style={{ height }} role="img" aria-label="内訳">
        {shares.map((s, i) =>
          s.ratio > 0 ? (
            <div key={i} style={{ width: `${s.ratio * 100}%`, background: data[i]!.color ?? PALETTE[i % PALETTE.length] }} title={`${data[i]!.label}: ${s.percent}%`} />
          ) : null,
        )}
      </div>
      {showLegend && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {shares.map((s, i) => (
            <li key={i} className="flex items-center gap-1.5">
              <span className="size-2 rounded-sm" style={{ background: data[i]!.color ?? PALETTE[i % PALETTE.length] }} />
              <span className="text-[var(--color-muted)]">{data[i]!.label}</span>
              <span className="font-medium tabular-nums">{s.percent}%</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
