"use client";
/** 散布図。 @packageDocumentation */
import { ResponsiveContainer, ScatterChart as RScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { cn } from "../../lib/cn";
import { ChartTitle, SeriesToggle, useSeriesVisibility, CHART_COLORS, makeFormatter, GRID_STROKE, type BaseChartProps } from "./chart-common";
import { regressionLine } from "../../lib/scatter-data";

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
  /**
   * 回帰直線(最小二乗法)を重ねる。**既定は false**。
   *
   * @remarks
   * 系列ごとに 1 本引く。**点が 2 未満、または x が全て同じ系列は引かない**(直線が定まらない)。
   * 凡例には `y = 1.23x + 4.56 (R²=0.87)` の形で式と当てはまりを出す。
   * 相関の強さは {@link fitStrength} で言葉にできる。
   */
  showRegression?: boolean;
}

/** 散布図(バブル可)。系列ごとに点群を渡す。 */
export function ScatterChart({
  series, title, height = 320, showLegend = true, showGrid = true, toggleable, xLabel, yLabel, unit, valueFormatter, colors = CHART_COLORS, className, showRegression = false,
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
          {showRegression && series.filter((s) => isVisible(s.key)).map((s) => {
            const line = regressionLine(s.points);
            if (!line) return null; // 点が 2 未満 / x が全て同じ = 直線が定まらない
            return (
              <Scatter
                key={`${s.key}-fit`}
                name={`${s.name ?? s.key}: ${line.equation} (R²=${line.r2.toFixed(2)})`}
                data={line.points}
                fill="none"
                line={{ stroke: colorMap.get(s.key), strokeWidth: 2, strokeDasharray: "5 4" }}
                shape={() => <g />}
                isAnimationActive={false}
                legendType="line"
              />
            );
          })}
        </RScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
