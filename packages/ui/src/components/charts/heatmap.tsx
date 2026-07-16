"use client";
/** ヒートマップ(数値の大小を色で表す格子)。 @packageDocumentation */
import { cn } from "../../lib/cn";
import { ChartTitle } from "./chart-common";
import { colorScale } from "./color-scale";

/** {@link Heatmap} の props。 */
export interface HeatmapProps {
  /** セル配列 { x, y, value }。 */
  data: { x: string; y: string; value: number }[];
  title?: string;
  /** 低い値の色。 */
  colorFrom?: string;
  /** 高い値の色。 */
  colorTo?: string;
  /** セルに数値を表示する。 */
  showValues?: boolean;
  unit?: string;
  /** セルの高さ(px、既定 36)。 */
  cellHeight?: number;
  className?: string;
}

/** ヒートマップ。行(y)×列(x)の格子で値の大小を色表示。 */
export function Heatmap({ data, title, colorFrom = "#e0f2f1", colorTo = "#0d9488", showValues, unit, cellHeight = 36, className }: HeatmapProps) {
  const xs = [...new Set(data.map((d) => d.x))];
  const ys = [...new Set(data.map((d) => d.y))];
  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const cell = new Map(data.map((d) => [`${d.x}|${d.y}`, d.value]));

  return (
    <div className={cn("w-full overflow-x-auto", className)}>
      <ChartTitle>{title}</ChartTitle>
      <div className="inline-grid gap-px" style={{ gridTemplateColumns: `auto repeat(${xs.length}, minmax(44px, 1fr))` }}>
        <div />
        {xs.map((x) => <div key={x} className="px-1 pb-1 text-center text-xs text-[var(--color-muted)]">{x}</div>)}
        {ys.map((y) => (
          <div key={y} style={{ display: "contents" }}>
            <div className="flex items-center pr-2 text-xs text-[var(--color-muted)]">{y}</div>
            {xs.map((x) => {
              const v = cell.get(`${x}|${y}`);
              return (
                <div key={x} title={v != null ? `${x} / ${y}: ${v}${unit ?? ""}` : ""}
                  className="flex items-center justify-center rounded-sm text-xs"
                  style={{ height: cellHeight, background: v != null ? colorScale(v, min, max, colorFrom, colorTo) : "transparent", color: v != null && (v - min) / (max - min || 1) > 0.6 ? "#fff" : "var(--color-fg)" }}>
                  {showValues && v != null ? v : ""}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs text-[var(--color-muted)]">
        <span>{min}{unit}</span>
        <span className="h-2 w-24 rounded" style={{ background: `linear-gradient(to right, ${colorFrom}, ${colorTo})` }} />
        <span>{max}{unit}</span>
      </div>
    </div>
  );
}
