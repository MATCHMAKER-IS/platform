"use client";
/** 帯グラフ(100%積み上げ)とヒストグラム。 @packageDocumentation */
import { ResponsiveContainer, ComposedChart, Bar, BarChart as RBarChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { cn } from "../../lib/cn.js";
import { ChartTitle, buildColorMap, GRID_STROKE, type SeriesDef } from "./chart-common.js";
import { toPercentStacked, histogramBins } from "./chart-math.js";

/** {@link BandChart} の props。 */
export interface BandChartProps {
  data: Record<string, unknown>[];
  xKey: string;
  series: SeriesDef[];
  title?: string;
  height?: number;
  /** 横帯にする(既定 true)。false で縦帯。 */
  horizontal?: boolean;
  showLegend?: boolean;
  colors?: string[];
  className?: string;
}

/** 帯グラフ。各項目を 100% に正規化して構成比を帯で表す。 */
export function BandChart({ data, xKey, series, title, height = 280, horizontal = true, showLegend = true, colors, className }: BandChartProps) {
  const pct = toPercentStacked(data, series.map((s) => s.key));
  const colorMap = buildColorMap(series, colors);
  const fmt = (v: number) => `${Math.round(v)}%`;
  return (
    <div className={cn("w-full", className)}>
      <ChartTitle>{title}</ChartTitle>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={pct} layout={horizontal ? "vertical" : "horizontal"}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
          {horizontal
            ? <><XAxis type="number" domain={[0, 100]} tickFormatter={fmt} tick={{ fontSize: 12 }} /><YAxis type="category" dataKey={xKey} tick={{ fontSize: 12 }} width={80} /></>
            : <><XAxis dataKey={xKey} tick={{ fontSize: 12 }} /><YAxis type="number" domain={[0, 100]} tickFormatter={fmt} tick={{ fontSize: 12 }} /></>}
          <Tooltip formatter={(v: number) => fmt(v)} />
          {showLegend && <Legend />}
          {series.map((s) => <Bar key={s.key} dataKey={s.key} name={s.name ?? s.key} stackId="band" fill={colorMap.get(s.key)} />)}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/** {@link Histogram} の props。 */
export interface HistogramProps {
  /** 生の数値配列。 */
  values: number[];
  /** ビン数(既定 10)。 */
  binCount?: number;
  title?: string;
  height?: number;
  color?: string;
  unit?: string;
  className?: string;
}

/** ヒストグラム。数値の分布(度数)を隙間なしの棒で表す。 */
export function Histogram({ values, binCount = 10, title, height = 280, color = "#0d9488", unit, className }: HistogramProps) {
  const bins = histogramBins(values, binCount);
  return (
    <div className={cn("w-full", className)}>
      <ChartTitle>{title}</ChartTitle>
      <ResponsiveContainer width="100%" height={height}>
        <RBarChart data={bins} barCategoryGap={0}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} angle={-30} textAnchor="end" height={50} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} label={{ value: "度数", angle: -90, position: "insideLeft" }} />
          <Tooltip formatter={(v: number) => [`${v}${unit ?? "件"}`, "度数"]} />
          <Bar dataKey="count" fill={color} />
        </RBarChart>
      </ResponsiveContainer>
    </div>
  );
}
