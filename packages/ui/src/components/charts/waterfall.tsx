"use client";
/** ウォーターフォール(増減の滝グラフ)。 @packageDocumentation */
import { ResponsiveContainer, ComposedChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { cn } from "../../lib/cn.js";
import { ChartTitle } from "./chart-common.js";
import { toWaterfall, type WaterfallItem } from "./chart-math.js";

/** {@link WaterfallChart} の props。 */
export interface WaterfallChartProps {
  items: WaterfallItem[];
  title?: string;
  height?: number;
  showGrid?: boolean;
  increaseColor?: string;
  decreaseColor?: string;
  totalColor?: string;
  unit?: string;
  className?: string;
}

/** ウォーターフォールチャート。売上→原価→利益 のような増減の内訳を表す。 */
export function WaterfallChart({
  items, title, height = 300, showGrid = true,
  increaseColor = "#16a34a", decreaseColor = "#dc2626", totalColor = "#0d9488", unit, className,
}: WaterfallChartProps) {
  const rows = toWaterfall(items);
  const colorOf = (k: string) => (k === "increase" ? increaseColor : k === "decrease" ? decreaseColor : totalColor);
  const fmt = unit ? (v: number) => `${v}${unit}` : undefined;
  return (
    <div className={cn("w-full", className)}>
      <ChartTitle>{title}</ChartTitle>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={rows}>
          {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />}
          <XAxis dataKey="label" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} tickFormatter={fmt} />
          <Tooltip formatter={(_v: number, _n: string, item: { payload?: { value: number; cumulative: number } }) =>
            item?.payload ? [`${item.payload.value >= 0 ? "+" : ""}${item.payload.value}${unit ?? ""}(累計 ${item.payload.cumulative}${unit ?? ""})`, "増減"] : _v} />
          <Bar dataKey="offset" stackId="wf" fill="transparent" />
          <Bar dataKey="bar" stackId="wf" radius={[3, 3, 0, 0]}>
            {rows.map((r, i) => <Cell key={i} fill={colorOf(r.kind)} />)}
          </Bar>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
