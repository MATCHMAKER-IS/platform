"use client";
/**
 * グラフ共通部品。パレット・系列トグル(表示/非表示チェックボックス)・タイトル・
 * 共通オプション型。各チャートはこれらを使う。
 * @packageDocumentation
 */
import * as React from "react";
import { cn } from "../../lib/cn.js";

/** 既定のカラーパレット(トークンのティール基調)。 */
export const CHART_COLORS = ["#0d9488", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#10b981", "#ec4899", "#64748b", "#eab308", "#06b6d4"];

/** 系列定義。 */
export interface SeriesDef {
  /** data 内のキー。 */
  key: string;
  /** 凡例に出す表示名(既定はキー)。 */
  name?: string;
  /** 色(未指定はパレット)。 */
  color?: string;
  /** 積み上げグループ(同じ stackId 同士が積み上がる)。 */
  stackId?: string;
  /** 複合グラフでの種別。 */
  type?: "bar" | "line";
}

/** 系列 → 色 のマップを作る(非表示にしても色がずれないよう全系列で採番)。 */
export function buildColorMap(series: SeriesDef[], colors: string[] = CHART_COLORS): Map<string, string> {
  return new Map(series.map((s, i) => [s.key, s.color ?? colors[i % colors.length]!]));
}

/** 系列の表示/非表示状態を管理するフック。 */
export function useSeriesVisibility(series: SeriesDef[]) {
  const [hidden, setHidden] = React.useState<Set<string>>(new Set());
  const isVisible = React.useCallback((key: string) => !hidden.has(key), [hidden]);
  const toggle = React.useCallback((key: string) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);
  return { isVisible, toggle, visibleSeries: series.filter((s) => isVisible(s.key)) };
}

/** 系列の表示/非表示チェックボックス群。 */
export function SeriesToggle({
  series, colorMap, isVisible, onToggle, className,
}: {
  series: SeriesDef[];
  colorMap: Map<string, string>;
  isVisible: (key: string) => boolean;
  onToggle: (key: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-x-4 gap-y-1.5", className)}>
      {series.map((s) => (
        <label key={s.key} className="flex cursor-pointer items-center gap-1.5 text-sm select-none">
          <input type="checkbox" checked={isVisible(s.key)} onChange={() => onToggle(s.key)} className="accent-[var(--color-primary)]" />
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: colorMap.get(s.key) }} />
          <span className={cn(!isVisible(s.key) && "text-[var(--color-muted)] line-through")}>{s.name ?? s.key}</span>
        </label>
      ))}
    </div>
  );
}

/** グラフタイトル。 */
export function ChartTitle({ children }: { children?: React.ReactNode }) {
  return children ? <h3 className="mb-2 text-sm font-semibold text-[var(--color-fg)]">{children}</h3> : null;
}

/** 全チャート共通のオプション。 */
export interface BaseChartProps {
  /** タイトル。 */
  title?: string;
  /** 高さ(px、既定 300)。 */
  height?: number;
  /** 凡例を表示(既定 true)。 */
  showLegend?: boolean;
  /** 背景グリッドを表示(既定 true)。 */
  showGrid?: boolean;
  /** 系列の表示/非表示チェックボックスを表示。 */
  toggleable?: boolean;
  /** X 軸ラベル。 */
  xLabel?: string;
  /** Y 軸ラベル。 */
  yLabel?: string;
  /** 単位(軸目盛・ツールチップに付与、例: "円", "%")。 */
  unit?: string;
  /** 値の整形(unit より優先)。 */
  valueFormatter?: (value: number) => string;
  /** 目標線などの参照線(値)。 */
  referenceValue?: number;
  /** カラーパレット上書き。 */
  colors?: string[];
  className?: string;
}

/** unit / valueFormatter から目盛・ツールチップ用フォーマッタを作る。 */
export function makeFormatter(unit?: string, valueFormatter?: (v: number) => string): ((v: number) => string) | undefined {
  if (valueFormatter) return valueFormatter;
  if (unit) return (v: number) => `${typeof v === "number" ? v.toLocaleString("ja-JP") : v}${unit}`;
  return undefined;
}

export const GRID_STROKE = "var(--color-border)";
