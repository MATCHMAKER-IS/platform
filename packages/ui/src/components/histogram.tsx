"use client";
/**
 * ヒストグラム(度数分布)。utils.histogram を用いてバー表示する。
 * @packageDocumentation
 */
import { histogram, type HistogramOptions } from "@platform/utils";
import { cn } from "../lib/cn";

/** {@link Histogram} の props。 */
export interface HistogramProps {
  values: number[];
  bins?: number;
  min?: number;
  max?: number;
  height?: number;
  /** 区間ラベルを表示。 */
  showLabels?: boolean;
  className?: string;
}

/** ヒストグラム。 */
export function Histogram({ values, bins, min, max, height = 120, showLabels = true, className }: HistogramProps) {
  const options: HistogramOptions = { bins, min, max };
  const data = histogram(values, options);
  if (data.length === 0) return null;
  const maxCount = Math.max(1, ...data.map((b) => b.count));
  const fmt = (n: number) => (Math.round(n * 10) / 10).toString();
  return (
    <div className={cn("flex flex-col", className)}>
      <div className="flex items-end gap-px" style={{ height }}>
        {data.map((b, i) => (
          <div key={i} className="flex flex-1 flex-col items-center justify-end" title={`${fmt(b.start)}–${fmt(b.end)}: ${b.count}`}>
            <span className="mb-0.5 text-[10px] text-[var(--color-muted)] tabular-nums">{b.count || ""}</span>
            <div className="w-full rounded-t bg-[var(--color-primary)]/60" style={{ height: `${(b.count / maxCount) * 100}%` }} />
          </div>
        ))}
      </div>
      {showLabels && (
        <div className="mt-1 flex gap-px text-[9px] text-[var(--color-muted)]">
          {data.map((b, i) => <div key={i} className="flex-1 truncate text-center">{fmt(b.start)}</div>)}
        </div>
      )}
    </div>
  );
}
