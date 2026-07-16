"use client";
/**
 * 直交座標系グラフ: 棒(積み上げ/横棒)・折れ線(スムーズ/エリア)・複合(棒+折れ線)。
 * @packageDocumentation
 */
import * as React from "react";
import {
  ResponsiveContainer, ComposedChart, Bar, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, Brush,
} from "recharts";
import { cn } from "../../lib/cn";
import {
  ChartTitle, SeriesToggle, useSeriesVisibility, buildColorMap, makeFormatter,
  GRID_STROKE, type SeriesDef, type BaseChartProps,
} from "./chart-common";

/** 直交系グラフの共通 props。 */
export interface CartesianChartProps extends BaseChartProps {
  /** データ配列。 */
  data: Record<string, unknown>[];
  /** X 軸(カテゴリ)のキー。 */
  xKey: string;
  /** 系列。 */
  series: SeriesDef[];
}

function Frame({
  title, toggleable, series, colorMap, isVisible, toggle, children,
}: {
  title?: string; toggleable?: boolean; series: SeriesDef[]; colorMap: Map<string, string>;
  isVisible: (k: string) => boolean; toggle: (k: string) => void; children: React.ReactNode;
}) {
  return (
    <div className="w-full">
      <ChartTitle>{title}</ChartTitle>
      {toggleable && <SeriesToggle series={series} colorMap={colorMap} isVisible={isVisible} onToggle={toggle} className="mb-2" />}
      {children}
    </div>
  );
}

function axes(xKey: string, horizontal: boolean, fmt?: (v: number) => string, xLabel?: string, yLabel?: string) {
  return horizontal ? (
    <>
      <XAxis type="number" tickFormatter={fmt} label={xLabel ? { value: xLabel, position: "insideBottom", offset: -4 } : undefined} tick={{ fontSize: 12 }} />
      <YAxis type="category" dataKey={xKey} tick={{ fontSize: 12 }} width={90} />
    </>
  ) : (
    <>
      <XAxis dataKey={xKey} tick={{ fontSize: 12 }} label={xLabel ? { value: xLabel, position: "insideBottom", offset: -4 } : undefined} />
      <YAxis tickFormatter={fmt} tick={{ fontSize: 12 }} label={yLabel ? { value: yLabel, angle: -90, position: "insideLeft" } : undefined} />
    </>
  );
}

/** 棒グラフ。`stacked` で積み上げ、`horizontal` で横棒。系列ごとの `stackId` で複数積み上げ群も可。 */
export function BarChart({
  data, xKey, series, stacked, horizontal, brush, className,
  title, height = 300, showLegend = true, showGrid = true, toggleable, xLabel, yLabel, unit, valueFormatter, referenceValue, colors,
}: CartesianChartProps & { stacked?: boolean; horizontal?: boolean; brush?: boolean }) {
  const colorMap = buildColorMap(series, colors);
  const { isVisible, toggle, visibleSeries } = useSeriesVisibility(series);
  const fmt = makeFormatter(unit, valueFormatter);
  return (
    <Frame title={title} toggleable={toggleable} series={series} colorMap={colorMap} isVisible={isVisible} toggle={toggle}>
      <ResponsiveContainer width="100%" height={height} className={cn(className)}>
        <ComposedChart data={data} layout={horizontal ? "vertical" : "horizontal"}>
          {showGrid && <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />}
          {axes(xKey, !!horizontal, fmt, xLabel, yLabel)}
          <Tooltip formatter={fmt ? (v: number) => fmt(v) : undefined} />
          {showLegend && <Legend />}
          {brush && <Brush dataKey={xKey} height={22} travellerWidth={8} stroke="var(--color-primary)" />}
          {referenceValue != null && <ReferenceLine {...(horizontal ? { x: referenceValue } : { y: referenceValue })} stroke="#ef4444" strokeDasharray="4 4" />}
          {visibleSeries.map((s) => (
            <Bar key={s.key} dataKey={s.key} name={s.name ?? s.key} fill={colorMap.get(s.key)} stackId={stacked ? "stack" : s.stackId} radius={stacked ? undefined : [3, 3, 0, 0]} />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </Frame>
  );
}

/** 折れ線グラフ。`smooth` で曲線、`area` で塗りつぶし(エリアチャート)。 */
export function LineChart({
  data, xKey, series, smooth, area, brush, className,
  title, height = 300, showLegend = true, showGrid = true, toggleable, xLabel, yLabel, unit, valueFormatter, referenceValue, colors,
}: CartesianChartProps & { smooth?: boolean; area?: boolean; brush?: boolean }) {
  const colorMap = buildColorMap(series, colors);
  const { isVisible, toggle, visibleSeries } = useSeriesVisibility(series);
  const fmt = makeFormatter(unit, valueFormatter);
  const curve = smooth ? "monotone" : "linear";
  return (
    <Frame title={title} toggleable={toggleable} series={series} colorMap={colorMap} isVisible={isVisible} toggle={toggle}>
      <ResponsiveContainer width="100%" height={height} className={cn(className)}>
        <ComposedChart data={data}>
          {showGrid && <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />}
          {axes(xKey, false, fmt, xLabel, yLabel)}
          <Tooltip formatter={fmt ? (v: number) => fmt(v) : undefined} />
          {showLegend && <Legend />}
          {brush && <Brush dataKey={xKey} height={22} travellerWidth={8} stroke="var(--color-primary)" />}
          {referenceValue != null && <ReferenceLine y={referenceValue} stroke="#ef4444" strokeDasharray="4 4" />}
          {visibleSeries.map((s) =>
            area ? (
              <Area key={s.key} type={curve} dataKey={s.key} name={s.name ?? s.key} stroke={colorMap.get(s.key)} fill={colorMap.get(s.key)} fillOpacity={0.2} />
            ) : (
              <Line key={s.key} type={curve} dataKey={s.key} name={s.name ?? s.key} stroke={colorMap.get(s.key)} dot={false} strokeWidth={2} />
            ),
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </Frame>
  );
}

/** 複合グラフ(棒+折れ線)。各系列の `type: "bar" | "line"` で描き分ける。棒は `stacked` で積み上げ。 */
export function ComboChart({
  data, xKey, series, stacked, brush, className,
  title, height = 300, showLegend = true, showGrid = true, toggleable, xLabel, yLabel, unit, valueFormatter, referenceValue, colors,
}: CartesianChartProps & { stacked?: boolean; brush?: boolean }) {
  const colorMap = buildColorMap(series, colors);
  const { isVisible, toggle, visibleSeries } = useSeriesVisibility(series);
  const fmt = makeFormatter(unit, valueFormatter);
  return (
    <Frame title={title} toggleable={toggleable} series={series} colorMap={colorMap} isVisible={isVisible} toggle={toggle}>
      <ResponsiveContainer width="100%" height={height} className={cn(className)}>
        <ComposedChart data={data}>
          {showGrid && <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />}
          {axes(xKey, false, fmt, xLabel, yLabel)}
          <Tooltip formatter={fmt ? (v: number) => fmt(v) : undefined} />
          {showLegend && <Legend />}
          {brush && <Brush dataKey={xKey} height={22} travellerWidth={8} stroke="var(--color-primary)" />}
          {referenceValue != null && <ReferenceLine y={referenceValue} stroke="#ef4444" strokeDasharray="4 4" />}
          {visibleSeries.map((s) =>
            s.type === "line" ? (
              <Line key={s.key} type="monotone" dataKey={s.key} name={s.name ?? s.key} stroke={colorMap.get(s.key)} strokeWidth={2} dot={false} />
            ) : (
              <Bar key={s.key} dataKey={s.key} name={s.name ?? s.key} fill={colorMap.get(s.key)} stackId={stacked ? "stack" : s.stackId} radius={[3, 3, 0, 0]} />
            ),
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </Frame>
  );
}

/** 横棒グラフ(BarChart の横向き専用ラッパー)。 */
export function HorizontalBarChart(props: CartesianChartProps & { stacked?: boolean; brush?: boolean }) {
  return <BarChart {...props} horizontal />;
}
