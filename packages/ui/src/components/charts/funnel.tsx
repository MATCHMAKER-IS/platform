"use client";
/** ファネルチャート(段階ごとの減少)。 @packageDocumentation */
import { ResponsiveContainer, FunnelChart as RFunnelChart, Funnel, LabelList, Tooltip, Cell } from "recharts";
import { cn } from "../../lib/cn.js";
import { ChartTitle, CHART_COLORS } from "./chart-common.js";

/** {@link FunnelChart} の props。 */
export interface FunnelChartProps {
  /** { name, value } の配列(値の降順推奨)。 */
  data: { name: string; value: number }[];
  title?: string;
  height?: number;
  /** ラベル(名称・値)を表示。 */
  showLabels?: boolean;
  colors?: string[];
  className?: string;
}

/** ファネルチャート。コンバージョン等の段階遷移に。 */
export function FunnelChart({ data, title, height = 320, showLabels = true, colors = CHART_COLORS, className }: FunnelChartProps) {
  return (
    <div className={cn("w-full", className)}>
      <ChartTitle>{title}</ChartTitle>
      <ResponsiveContainer width="100%" height={height}>
        <RFunnelChart>
          <Tooltip />
          <Funnel dataKey="value" nameKey="name" data={data} isAnimationActive={false}>
            {showLabels && <LabelList position="right" fill="var(--color-fg)" stroke="none" dataKey="name" />}
            {showLabels && <LabelList position="center" fill="#fff" stroke="none" dataKey="value" />}
            {data.map((_d, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
          </Funnel>
        </RFunnelChart>
      </ResponsiveContainer>
    </div>
  );
}
