"use client";
/** 円グラフ / ドーナツ。 @packageDocumentation */
import { ResponsiveContainer, PieChart as RPieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import { cn } from "../../lib/cn";
import { ChartTitle, CHART_COLORS, makeFormatter } from "./chart-common";

/** {@link PieChart} の props。 */
export interface PieChartProps {
  data: Record<string, unknown>[];
  /** 名称のキー。 */
  nameKey: string;
  /** 値のキー。 */
  valueKey: string;
  title?: string;
  height?: number;
  /** ドーナツにする(中央を空ける)。 */
  donut?: boolean;
  /** 割合ラベルを表示。 */
  showLabels?: boolean;
  showLegend?: boolean;
  unit?: string;
  valueFormatter?: (v: number) => string;
  colors?: string[];
  className?: string;
}

/** 円グラフ。`donut` でドーナツ、`showLabels` で割合表示。 */
export function PieChart({
  data, nameKey, valueKey, title, height = 300, donut, showLabels, showLegend = true, unit, valueFormatter, colors = CHART_COLORS, className,
}: PieChartProps) {
  const fmt = makeFormatter(unit, valueFormatter);
  return (
    <div className={cn("w-full", className)}>
      <ChartTitle>{title}</ChartTitle>
      <ResponsiveContainer width="100%" height={height}>
        <RPieChart>
          <Pie
            data={data} nameKey={nameKey} dataKey={valueKey}
            innerRadius={donut ? "55%" : 0} outerRadius="80%" paddingAngle={donut ? 2 : 0}
            label={showLabels ? (e: { percent?: number }) => `${Math.round((e.percent ?? 0) * 100)}%` : undefined}
          >
            {data.map((_row, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
          </Pie>
          <Tooltip formatter={fmt ? (v: number) => fmt(v) : undefined} />
          {showLegend && <Legend />}
        </RPieChart>
      </ResponsiveContainer>
    </div>
  );
}
