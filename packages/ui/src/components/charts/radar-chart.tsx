"use client";
/** レーダーチャート。 @packageDocumentation */
import { ResponsiveContainer, RadarChart as RRadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Tooltip, Legend } from "recharts";
import { cn } from "../../lib/cn.js";
import { ChartTitle, SeriesToggle, useSeriesVisibility, buildColorMap, type SeriesDef, type BaseChartProps } from "./chart-common.js";

/** {@link RadarChart} の props。 */
export interface RadarChartProps extends BaseChartProps {
  data: Record<string, unknown>[];
  /** 軸(項目名)のキー。 */
  xKey: string;
  series: SeriesDef[];
}

/** レーダーチャート。複数系列の比較に。 */
export function RadarChart({
  data, xKey, series, title, height = 320, showLegend = true, showGrid = true, toggleable, colors, className,
}: RadarChartProps) {
  const colorMap = buildColorMap(series, colors);
  const { isVisible, toggle, visibleSeries } = useSeriesVisibility(series);
  return (
    <div className={cn("w-full", className)}>
      <ChartTitle>{title}</ChartTitle>
      {toggleable && <SeriesToggle series={series} colorMap={colorMap} isVisible={isVisible} onToggle={toggle} className="mb-2" />}
      <ResponsiveContainer width="100%" height={height}>
        <RRadarChart data={data}>
          {showGrid && <PolarGrid />}
          <PolarAngleAxis dataKey={xKey} tick={{ fontSize: 12 }} />
          <PolarRadiusAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          {showLegend && <Legend />}
          {visibleSeries.map((s) => (
            <Radar key={s.key} dataKey={s.key} name={s.name ?? s.key} stroke={colorMap.get(s.key)} fill={colorMap.get(s.key)} fillOpacity={0.3} />
          ))}
        </RRadarChart>
      </ResponsiveContainer>
    </div>
  );
}
