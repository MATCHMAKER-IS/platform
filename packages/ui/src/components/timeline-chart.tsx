"use client";
/**
 * 時系列ラインチャート(SVG・依存なし)。複数系列と予測バンドに対応する。
 * @packageDocumentation
 */
import * as React from "react";
import { cn } from "../lib/cn";

/** 系列。 */
export interface TimelineSeries {
  name?: string;
  points: Array<{ x: number; y: number }>;
  color?: string;
  showArea?: boolean;
}

/** 予測バンド(下限・上限の帯)。 */
export interface TimelineBand {
  points: Array<{ x: number; lower: number; upper: number }>;
  color?: string;
}

/** {@link TimelineChart} の props。 */
export interface TimelineChartProps {
  series: TimelineSeries[];
  band?: TimelineBand;
  width?: number;
  height?: number;
  /** x 軸ラベル(下部)。 */
  xLabels?: string[];
  showLegend?: boolean;
  /** ホバーで最近接 x の値をツールチップ表示。 */
  showTooltip?: boolean;
  /** ツールチップの x ラベル整形(既定は x 値)。 */
  formatX?: (x: number) => string;
  /** ツールチップの y 値整形。 */
  formatY?: (y: number) => string;
  className?: string;
}

const PALETTE = ["var(--color-primary)", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6"];

/** 時系列ラインチャート。 */
/**
 * 時系列の帯(期間の重なり)。
 *
 * 案件・工程・貸出のように、**始まりと終わりがあるもの**を並べて見る。
 * 重なりや空きが視覚的に分かるので、日程の調整に向く。
 */
export function TimelineChart({ series, band, width = 480, height = 240, xLabels, showLegend = true, showTooltip = false, formatX, formatY, className }: TimelineChartProps) {
  const allX: number[] = [];
  const allY: number[] = [];
  for (const s of series) for (const p of s.points) { allX.push(p.x); allY.push(p.y); }
  if (band) for (const p of band.points) { allX.push(p.x); allY.push(p.lower, p.upper); }
  if (allX.length === 0) return null;

  const xMin = Math.min(...allX), xMax = Math.max(...allX);
  const yMin = Math.min(...allY), yMax = Math.max(...allY);
  const xSpan = xMax - xMin || 1, ySpan = yMax - yMin || 1;
  const padL = 8, padR = 8, padT = 8, padB = xLabels ? 20 : 8;
  const sx = (x: number) => padL + ((x - xMin) / xSpan) * (width - padL - padR);
  const sy = (y: number) => height - padB - ((y - yMin) / ySpan) * (height - padT - padB);

  const line = (pts: Array<{ x: number; y: number }>) => pts.map((p) => `${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(" ");

  const uniqueXs = Array.from(new Set(allX)).sort((a, b) => a - b);
  const [hoverX, setHoverX] = React.useState<number | null>(null);
  const svgRef = React.useRef<SVGSVGElement | null>(null);
  const onMove = (e: React.MouseEvent) => {
    if (!showTooltip || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * width;
    const dataX = xMin + ((px - padL) / (width - padL - padR)) * xSpan;
    let nearest = uniqueXs[0]!;
    for (const x of uniqueXs) if (Math.abs(x - dataX) < Math.abs(nearest - dataX)) nearest = x;
    setHoverX(nearest);
  };
  const fmtX = formatX ?? ((x: number) => String(x));
  const fmtY = formatY ?? ((y: number) => String(Math.round(y * 100) / 100));
  const hoverRows = hoverX == null ? [] : series.map((sr, i) => {
    const pt = sr.points.find((p) => p.x === hoverX);
    return pt ? { name: sr.name ?? `系列${i + 1}`, y: pt.y, color: sr.color ?? PALETTE[i % PALETTE.length] } : null;
  }).filter(Boolean) as Array<{ name: string; y: number; color: string }>;

  return (
    <div className={cn("inline-block", className)}>
      <svg ref={svgRef} width={width} height={height} viewBox={`0 0 ${width} ${height}`} onMouseMove={onMove} onMouseLeave={() => setHoverX(null)} style={{ display: "block" }}>
        <rect x={0} y={0} width={width} height={height} fill="none" stroke="var(--color-border)" strokeWidth={1} />
        {band && band.points.length > 1 && (
          <polygon
            points={`${band.points.map((p) => `${sx(p.x).toFixed(1)},${sy(p.upper).toFixed(1)}`).join(" ")} ${[...band.points].reverse().map((p) => `${sx(p.x).toFixed(1)},${sy(p.lower).toFixed(1)}`).join(" ")}`}
            fill={band.color ?? "var(--color-primary)"}
            opacity={0.12}
          />
        )}
        {series.map((s, i) => {
          const color = s.color ?? PALETTE[i % PALETTE.length];
          return (
            <g key={i}>
              {s.showArea && s.points.length > 1 && (
                <polygon points={`${sx(s.points[0]!.x)},${height - padB} ${line(s.points)} ${sx(s.points[s.points.length - 1]!.x)},${height - padB}`} fill={color} opacity={0.1} />
              )}
              <polyline points={line(s.points)} fill="none" stroke={color} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
            </g>
          );
        })}
        {showTooltip && hoverX != null && (
          <g>
            <line x1={sx(hoverX)} y1={padT} x2={sx(hoverX)} y2={height - padB} stroke="var(--color-muted)" strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />
            {hoverRows.map((r, i) => <circle key={i} cx={sx(hoverX)} cy={sy(r.y)} r={3} fill={r.color} />)}
          </g>
        )}
        {xLabels && xLabels.map((lbl, i) => {
          const x = sx(xMin + (i / Math.max(1, xLabels.length - 1)) * xSpan);
          return <text key={i} x={x} y={height - 6} fontSize={9} textAnchor="middle" fill="var(--color-muted)">{lbl}</text>;
        })}
      </svg>
      {showTooltip && hoverX != null && hoverRows.length > 0 && (
        <div className="mt-1 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-xs shadow-sm">
          <div className="mb-0.5 font-medium text-[var(--color-muted)]">{fmtX(hoverX)}</div>
          {hoverRows.map((r, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-sm" style={{ background: r.color }} />
              <span className="text-[var(--color-muted)]">{r.name}</span>
              <span className="ml-auto font-medium tabular-nums">{fmtY(r.y)}</span>
            </div>
          ))}
        </div>
      )}
      {showLegend && series.some((s) => s.name) && (
        <div className="mt-1 flex flex-wrap gap-3 text-xs">
          {series.map((s, i) => s.name && (
            <span key={i} className="inline-flex items-center gap-1">
              <span className="inline-block h-2 w-3 rounded-sm" style={{ background: s.color ?? PALETTE[i % PALETTE.length] }} />
              <span className="text-[var(--color-muted)]">{s.name}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
