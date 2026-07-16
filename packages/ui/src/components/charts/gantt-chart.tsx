"use client";
/** ガントチャート(横棒積み上げで期間を表現)。 @packageDocumentation */
import { ResponsiveContainer, BarChart as RBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from "recharts";
import { cn } from "../../lib/cn";
import { ChartTitle, CHART_COLORS, GRID_STROKE } from "./chart-common";
import { toGanttRows, type GanttTask } from "./gantt-transform";

/** {@link GanttChart} の props。 */
export interface GanttChartProps {
  tasks: GanttTask[];
  title?: string;
  height?: number;
  showGrid?: boolean;
  /** X 軸の目盛整形(既定は日付 M/D)。 */
  tickFormatter?: (ms: number) => string;
  colors?: string[];
  className?: string;
}

const defaultTick = (v: number) => { const d = new Date(v); return `${d.getMonth() + 1}/${d.getDate()}`; };

/** ガントチャート。タスクの開始〜終了を横棒で表示する。 */
export function GanttChart({ tasks, title, height, showGrid = true, tickFormatter = defaultTick, colors = CHART_COLORS, className }: GanttChartProps) {
  const { rows, min, max } = toGanttRows(tasks);
  const h = height ?? Math.max(120, rows.length * 40 + 60);
  return (
    <div className={cn("w-full", className)}>
      <ChartTitle>{title}</ChartTitle>
      <ResponsiveContainer width="100%" height={h}>
        <RBarChart data={rows} layout="vertical" barCategoryGap={8}>
          {showGrid && <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} horizontal={false} />}
          <XAxis type="number" domain={[0, max - min]} tickFormatter={(v: number) => tickFormatter(min + v)} tick={{ fontSize: 12 }} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={110} />
          <Tooltip
            formatter={(v: number, _n: string, item: { payload?: { start: number; end: number } }) =>
              item?.payload ? [`${tickFormatter(item.payload.start)} 〜 ${tickFormatter(item.payload.end)}`, "期間"] : v}
          />
          <Bar dataKey="offset" stackId="g" fill="transparent" />
          <Bar dataKey="duration" stackId="g" radius={[3, 3, 3, 3]}>
            {rows.map((r, i) => <Cell key={i} fill={r.color ?? colors[i % colors.length]} />)}
          </Bar>
        </RBarChart>
      </ResponsiveContainer>
    </div>
  );
}
