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

/**
 * 指標カード(前期比つき)。
 *
 * `StatCard` が「今の値」だけを見せるのに対し、こちらは**前と比べてどうか**を見せる。
 * 経営や運用の画面で「増えた/減った」を判断させたいときに使う。
 *
 * | props | 使いどころ |
 * |---|---|
 * | `previous` | 前期の値。**渡すと増減が出る**。無ければ数値だけ |
 * | `series` | 推移の小さな折れ線。傾向が一目で分かる |
 * | `format` | 値の整形(既定は桁区切り)。通貨や小数に |
 * | `suffix` | 単位(「円」「%」)。値と分けると数字が読みやすい |
 * | `higherIsBetter` | **コストや離職率は `false`**。増加を赤で見せる |
 *
 * `higherIsBetter` を既定のままにすると、**費用が増えたときに緑(良い)で出る**。
 * 指標の性質に合わせて必ず確認する。
 *
 * @example
 * ```tsx
 * <KpiCard label="今月の売上" value={1240000} previous={1180000} suffix="円" series={last12} />
 * <KpiCard label="解約率" value={3.2} previous={2.8} suffix="%" higherIsBetter={false} />
 * ```
 */
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
