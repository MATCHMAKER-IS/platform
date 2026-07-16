"use client";
/**
 * KPI カード。値・前期比(Trend)・スパークラインを 1 枚にまとめる複合コンポーネント。
 * @packageDocumentation
 */
import { formatNumber } from "@platform/utils";
import { cn } from "../lib/cn";
import { Sparkline } from "./sparkline";
import { Trend } from "./trend";

/** {@link KpiCard} の props。 */
export interface KpiCardProps {
  label: string;
  value: number;
  /** 前期の値(指定で Trend 表示)。 */
  previous?: number;
  /** スパークライン用の系列。 */
  series?: number[];
  /** 値の整形(既定は桁区切り)。 */
  format?: (n: number) => string;
  /** 単位・接尾(例: "円", "%")。 */
  suffix?: string;
  /** 増加を良しとするか(コスト系は false)。 */
  higherIsBetter?: boolean;
  className?: string;
}

/** KPI カード。 */
export function KpiCard({ label, value, previous, series, format, suffix, higherIsBetter = true, className }: KpiCardProps) {
  const fmt = format ?? ((n: number) => formatNumber(n, {}));
  return (
    <div className={cn("flex flex-col gap-1 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-[var(--color-muted)]">{label}</span>
        {previous != null && <Trend current={value} previous={previous} higherIsBetter={higherIsBetter} />}
      </div>
      <div className="text-2xl font-bold tabular-nums text-[var(--color-fg)]">
        {fmt(value)}{suffix && <span className="ml-0.5 text-base font-medium text-[var(--color-muted)]">{suffix}</span>}
      </div>
      {series && series.length > 1 && <Sparkline values={series} width={200} height={36} showArea className="mt-1 w-full" />}
    </div>
  );
}
