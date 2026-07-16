"use client";
/** サンキー図(フロー図)。 @packageDocumentation */
import { ResponsiveContainer, Sankey as RSankey, Tooltip } from "recharts";
import { cn } from "../../lib/cn";
import { ChartTitle } from "./chart-common";

/** {@link SankeyChart} の props。 */
export interface SankeyChartProps {
  /** ノードとリンク({ source, target, value } は 0 始まりのノード添字)。 */
  data: { nodes: { name: string }[]; links: { source: number; target: number; value: number }[] };
  title?: string;
  height?: number;
  linkColor?: string;
  nodeColor?: string;
  className?: string;
}

/** サンキー図。段階間の流量(遷移・予算配分など)を帯の太さで表す。 */
export function SankeyChart({ data, title, height = 360, linkColor = "#0d948855", nodeColor = "#0d9488", className }: SankeyChartProps) {
  return (
    <div className={cn("w-full", className)}>
      <ChartTitle>{title}</ChartTitle>
      <ResponsiveContainer width="100%" height={height}>
        <RSankey
          data={data}
          nodePadding={24}
          link={{ stroke: linkColor }}
          node={{ fill: nodeColor }}
          margin={{ top: 8, right: 120, bottom: 8, left: 8 }}
        >
          <Tooltip />
        </RSankey>
      </ResponsiveContainer>
    </div>
  );
}
