"use client";
/**
 * ファネル。段階ごとの数と遷移率・離脱を縦に表示する(申込→審査→承認など)。
 * @packageDocumentation
 */
import { cn } from "../lib/cn";
import { funnelStages } from "../lib/dashboard";

/** ファネルの 1 段。 */
export interface FunnelStep {
  label: string;
  value: number;
}

/** {@link Funnel} の props。 */
export interface FunnelProps {
  steps: FunnelStep[];
  /** 値の整形(既定は桁区切り)。 */
  format?: (n: number) => string;
  /** バーの色。 */
  barColor?: string;
  /** 各段に直前からの遷移率を表示。 */
  showConversion?: boolean;
  className?: string;
}

const defaultFormat = (n: number) => n.toLocaleString("ja-JP");

/** ファネル。先頭を 100% とした幅で各段を描画し、遷移率・離脱を示す。 */
export function Funnel({ steps, format = defaultFormat, barColor = "var(--color-primary)", showConversion = true, className }: FunnelProps) {
  if (steps.length === 0) return null;
  const stages = funnelStages(steps);
  return (
    <ol className={cn("space-y-3", className)}>
      {stages.map((stage, i) => (
        <li key={i}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
            <span className="text-[var(--color-fg)]">{stage.label}</span>
            <span className="font-medium tabular-nums">{format(stage.value)}</span>
          </div>
          <div className="h-6 overflow-hidden rounded bg-[var(--color-border)]/30">
            <div className="flex h-full items-center rounded transition-[width]" style={{ width: `${Math.max(2, stage.ratioToFirst * 100)}%`, background: barColor }} />
          </div>
          {showConversion && i > 0 && (
            <div className="mt-0.5 flex justify-between text-xs text-[var(--color-muted)] tabular-nums">
              <span>遷移率 {Math.round(stage.conversionFromPrev * 1000) / 10}%</span>
              {stage.dropoff > 0 && <span>離脱 {format(stage.dropoff)}</span>}
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}
