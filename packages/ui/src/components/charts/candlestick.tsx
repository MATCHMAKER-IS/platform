"use client";
/** ローソク足チャート(OHLC)。 @packageDocumentation */
import { ResponsiveContainer, ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { cn } from "../../lib/cn.js";
import { ChartTitle } from "./chart-common.js";
import { candleGeometry, type Candle } from "./chart-math.js";

/** ローソク足の 1 本。 */
export interface Candlestick extends Candle { label: string }

/** {@link CandlestickChart} の props。 */
export interface CandlestickChartProps {
  data: Candlestick[];
  title?: string;
  height?: number;
  showGrid?: boolean;
  /** 陽線の色。 */
  upColor?: string;
  /** 陰線の色。 */
  downColor?: string;
  unit?: string;
  className?: string;
}

function CandleShape(props: { x?: number; y?: number; width?: number; height?: number; payload?: Candle; upColor: string; downColor: string }) {
  const { x = 0, y = 0, width = 0, height = 0, payload, upColor, downColor } = props;
  if (!payload) return null;
  const g = candleGeometry(payload, x, width, y, height);
  const color = g.up ? upColor : downColor;
  return (
    <g stroke={color} fill={color}>
      <line x1={g.cx} x2={g.cx} y1={g.wickY} y2={g.wickY + g.wickH} strokeWidth={1} />
      <rect x={g.bodyX} y={g.bodyY} width={g.bodyW} height={g.bodyH} />
    </g>
  );
}

/** ローソク足チャート。株価等の OHLC を表示。 */
export function CandlestickChart({ data, title, height = 320, showGrid = true, upColor = "#16a34a", downColor = "#dc2626", unit, className }: CandlestickChartProps) {
  return (
    <div className={cn("w-full", className)}>
      <ChartTitle>{title}</ChartTitle>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data}>
          {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />}
          <XAxis dataKey="label" tick={{ fontSize: 12 }} />
          <YAxis domain={[(min: number) => Math.floor(min * 0.98), (max: number) => Math.ceil(max * 1.02)]} tick={{ fontSize: 12 }} tickFormatter={unit ? (v: number) => `${v}${unit}` : undefined} />
          <Tooltip
            content={({ payload }: { payload?: { payload?: Candlestick }[] }) => {
              const c = payload?.[0]?.payload;
              if (!c) return null;
              return (
                <div style={{ background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: 6, padding: "6px 10px", fontSize: 12 }}>
                  <div style={{ fontWeight: 600 }}>{c.label}</div>
                  <div>始 {c.open} / 高 {c.high}</div>
                  <div>安 {c.low} / 終 {c.close}</div>
                </div>
              );
            }}
          />
          <Bar dataKey={(d: Candle) => [d.low, d.high]} shape={<CandleShape upColor={upColor} downColor={downColor} />} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
