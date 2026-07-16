"use client";
/** ツリーマップ(面積で大小を表す)。 @packageDocumentation */
import { ResponsiveContainer, Treemap as RTreemap, Tooltip } from "recharts";
import { cn } from "../../lib/cn";
import { ChartTitle, CHART_COLORS } from "./chart-common";

/** {@link Treemap} の props。 */
export interface TreemapProps {
  /** { name, size } の配列(または children を持つ入れ子)。 */
  data: { name: string; size?: number; children?: unknown[] }[];
  title?: string;
  height?: number;
  colors?: string[];
  className?: string;
}

/** ツリーマップ。構成比を面積で表す。 */
export function Treemap({ data, title, height = 320, colors = CHART_COLORS, className }: TreemapProps) {
  const colored = data.map((d, i) => ({ ...d, fill: colors[i % colors.length] }));
  return (
    <div className={cn("w-full", className)}>
      <ChartTitle>{title}</ChartTitle>
      <ResponsiveContainer width="100%" height={height}>
        <RTreemap data={colored} dataKey="size" nameKey="name" stroke="#fff" isAnimationActive={false}>
          <Tooltip />
        </RTreemap>
      </ResponsiveContainer>
    </div>
  );
}
