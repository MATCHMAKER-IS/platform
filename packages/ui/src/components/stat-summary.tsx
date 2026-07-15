"use client";
/**
 * 数値配列の要約(平均・中央値・四分位・標準偏差・外れ値件数)を一覧表示する。
 * @packageDocumentation
 */
import { mean, median, stddev, quartiles, outliers, min as fnMin, max as fnMax, formatNumber } from "@platform/utils";
import { cn } from "../lib/cn.js";

/** {@link StatSummary} の props。 */
export interface StatSummaryProps {
  values: number[];
  /** 数値の整形(既定は桁区切り小数1桁)。 */
  format?: (n: number) => string;
  /** 外れ値検出の係数(既定 1.5)。 */
  outlierK?: number;
  className?: string;
}

/** 要約統計サマリ。 */
export function StatSummary({ values, format, outlierK = 1.5, className }: StatSummaryProps) {
  const fmt = format ?? ((n: number) => formatNumber(n, { decimals: 1 }));
  const q = quartiles(values);
  const items: Array<[string, string]> = [
    ["件数", String(values.length)],
    ["平均", values.length ? fmt(mean(values)) : "—"],
    ["中央値", values.length ? fmt(median(values)) : "—"],
    ["標準偏差", values.length ? fmt(stddev(values)) : "—"],
    ["最小", values.length ? fmt(fnMin(values)) : "—"],
    ["最大", values.length ? fmt(fnMax(values)) : "—"],
    ["Q1", values.length ? fmt(q.q1) : "—"],
    ["Q3", values.length ? fmt(q.q3) : "—"],
    ["IQR", values.length ? fmt(q.iqr) : "—"],
    ["外れ値", String(outliers(values, outlierK).length)],
  ];
  return (
    <dl className={cn("grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-5", className)}>
      {items.map(([label, value]) => (
        <div key={label} className="flex flex-col rounded-[var(--radius)] border border-[var(--color-border)] px-3 py-1.5">
          <dt className="text-xs text-[var(--color-muted)]">{label}</dt>
          <dd className="font-semibold tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
