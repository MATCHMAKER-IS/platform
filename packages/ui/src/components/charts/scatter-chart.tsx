"use client";
/** 散布図。 @packageDocumentation */
import { ResponsiveContainer, ScatterChart as RScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { cn } from "../../lib/cn.js";
import { ChartTitle, SeriesToggle, useSeriesVisibility, CHART_COLORS, makeFormatter, GRID_STROKE, type BaseChartProps } from "./chart-common.js";

/** 散布図の系列(点群)。 */
export interface ScatterSeries {
  key: string;
  name?: string;
  color?: string;
  /** 点の配列。z を指定するとバブルの大きさに使われる。 */
  points: { x: number; y: number; z?: number }[];
}

/** {@link ScatterChart} の props。 */
export interface ScatterChartProps extends BaseChartProps {
  series: ScatterSeries[];
}

/** 散布図(バブル可)。系列ごとに点群を渡す。 */
export function ScatterChart({
  series, title, height = 320, showLegend = true, showGrid = true, toggleable, xLabel, yLabel, unit, valueFormatter, colors = CHART_COLORS, className,
}: ScatterChartProps) {
  const defs = series.map((s, i) => ({ key: s.key, name: s.name, color: s.color ?? colors[i % colors.length] }));
  const colorMap = new Map(defs.map((d) => [d.key, d.color!]));
  const { isVisible, toggle } = useSeriesVisibility(defs);
  const fmt = makeFormatter(unit, valueFormatter);
  const hasZ = series.some((s) => s.points.some((p) => p.z != null));
  return (
    <div className={cn("w-full", className)}>
      <ChartTitle>{title}</ChartTitle>
      {toggleable && <SeriesToggle series={defs} colorMap={colorMap} isVisible={isVisible} onToggle={toggle} className="mb-2" />}
      <ResponsiveContainer width="100%" height={height}>
        <RScatterChart>
          {showGrid && <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />}
          <XAxis type="number" dataKey="x" name={xLabel} tick={{ fontSize: 12 }} label={xLabel ? { value: xLabel, position: "insideBottom", offset: -4 } : undefined} />
          <YAxis type="number" dataKey="y" name={yLabel} tickFormatter={fmt} tick={{ fontSize: 12 }} label={yLabel ? { value: yLabel, angle: -90, position: "insideLeft" } : undefined} />
          {hasZ && <ZAxis type="number" dataKey="z" range={[40, 400]} />}
          <Tooltip cursor={{ strokeDasharray: "3 3" }} />
          {showLegend && <Legend />}
          {series.filter((s) => isVisible(s.key)).map((s) => (
            <Scatter key={s.key} name={s.name ?? s.key} data={s.points} fill={colorMap.get(s.key)} />
          ))}
        </RScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
