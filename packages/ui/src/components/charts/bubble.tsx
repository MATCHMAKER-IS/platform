"use client";
/** バブルチャート(散布図 + 大きさ z)。 @packageDocumentation */
import { ResponsiveContainer, ScatterChart as RScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { cn } from "../../lib/cn.js";
import { ChartTitle, SeriesToggle, useSeriesVisibility, CHART_COLORS, GRID_STROKE } from "./chart-common.js";

/** バブルの系列。 */
export interface BubbleSeries {
  key: string;
  name?: string;
  color?: string;
  points: { x: number; y: number; z: number }[];
}

/** {@link BubbleChart} の props。 */
export interface BubbleChartProps {
  series: BubbleSeries[];
  title?: string;
  height?: number;
  showLegend?: boolean;
  showGrid?: boolean;
  toggleable?: boolean;
  xLabel?: string;
  yLabel?: string;
  /** バブルの大きさ範囲 [min, max]。 */
  sizeRange?: [number, number];
  colors?: string[];
  className?: string;
}

/** バブルチャート。x/y に加え z(値)を円の大きさで表す。 */
export function BubbleChart({
  series, title, height = 340, showLegend = true, showGrid = true, toggleable, xLabel, yLabel, sizeRange = [80, 800], colors = CHART_COLORS, className,
}: BubbleChartProps) {
  const defs = series.map((s, i) => ({ key: s.key, name: s.name, color: s.color ?? colors[i % colors.length] }));
  const colorMap = new Map(defs.map((d) => [d.key, d.color!]));
  const { isVisible, toggle } = useSeriesVisibility(defs);
  return (
    <div className={cn("w-full", className)}>
      <ChartTitle>{title}</ChartTitle>
      {toggleable && <SeriesToggle series={defs} colorMap={colorMap} isVisible={isVisible} onToggle={toggle} className="mb-2" />}
      <ResponsiveContainer width="100%" height={height}>
        <RScatterChart>
          {showGrid && <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />}
          <XAxis type="number" dataKey="x" name={xLabel} tick={{ fontSize: 12 }} label={xLabel ? { value: xLabel, position: "insideBottom", offset: -4 } : undefined} />
          <YAxis type="number" dataKey="y" name={yLabel} tick={{ fontSize: 12 }} label={yLabel ? { value: yLabel, angle: -90, position: "insideLeft" } : undefined} />
          <ZAxis type="number" dataKey="z" range={sizeRange} />
          <Tooltip cursor={{ strokeDasharray: "3 3" }} />
          {showLegend && <Legend />}
          {series.filter((s) => isVisible(s.key)).map((s) => (
            <Scatter key={s.key} name={s.name ?? s.key} data={s.points} fill={colorMap.get(s.key)} fillOpacity={0.6} />
          ))}
        </RScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
