"use client";
/** ローソク足チャート(OHLC)。 @packageDocumentation */
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { cn } from "../../lib/cn";
import { ChartTitle } from "./chart-common";
import { candleGeometry, type Candle } from "./chart-math";

/** ローソク足の 1 本。 */
export interface Candlestick extends Candle {
  label: string;
  /** 移動平均(任意)。`withMovingAverage()` が付ける。**計算できない先頭は null**。 */
  ma?: number | null;
}

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
  /**
   * 移動平均を重ねる区間(例 5 なら 5 本移動平均)。
   * **`data` に `ma` が入っている前提**。`withMovingAverage()` で作ると
   * 長さと日付が揃う(自前で `movingAverage` を呼ぶと **window-1 本ぶんずれる**)。
   */
  maWindow?: number;
  /** 移動平均線の色。 */
  maColor?: string;
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
export function CandlestickChart({ data, title, height = 320, showGrid = true, upColor = "#16a34a", downColor = "#dc2626", unit, className, maWindow, maColor = "var(--color-primary)" }: CandlestickChartProps) {
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
                  {typeof (c as Candlestick & { ma?: number | null }).ma === "number" && (
                    <div style={{ color: maColor }}>MA{maWindow} {(c as Candlestick & { ma?: number | null }).ma}</div>
                  )}
                </div>
              );
            }}
          />
          <Bar dataKey={(d: Candle) => [d.low, d.high]} shape={<CandleShape upColor={upColor} downColor={downColor} />} isAnimationActive={false} />
          {maWindow !== undefined && (
            <>
              <Line type="monotone" dataKey="ma" name={`MA${maWindow}`} stroke={maColor} strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
              <Legend />
            </>
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
