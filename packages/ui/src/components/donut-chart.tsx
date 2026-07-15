"use client";
/**
 * ドーナツチャート(依存なし・SVG)。構成比を円で表す。凡例つき。
 * @packageDocumentation
 */
import { cn } from "../lib/cn.js";
import { donutSegments } from "../lib/dashboard.js";

/** ドーナツの 1 項目。 */
export interface DonutDatum {
  label: string;
  value: number;
  /** 色(CSS 色。未指定は既定パレット)。 */
  color?: string;
}

/** 既定のカテゴリ色。 */
const PALETTE = ["#2563eb", "#16a34a", "#f59e0b", "#dc2626", "#7c3aed", "#0891b2", "#db2777", "#65a30d"];

/** {@link DonutChart} の props。 */
export interface DonutChartProps {
  data: DonutDatum[];
  size?: number;
  strokeWidth?: number;
  /** 中央に表示する内容(合計値など)。 */
  centerLabel?: React.ReactNode;
  /** 凡例を表示。 */
  showLegend?: boolean;
  className?: string;
}

/** ドーナツチャート。構成比を色分けした円で表示する。 */
export function DonutChart({ data, size = 160, strokeWidth = 24, centerLabel, showLegend = true, className }: DonutChartProps) {
  if (data.length === 0) return null;
  const radius = (size - strokeWidth) / 2;
  const segments = donutSegments(data.map((d) => d.value), radius);
  const center = size / 2;
  return (
    <div className={cn("flex items-center gap-4", className)}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
        <g transform={`rotate(-90 ${center} ${center})`}>
          <circle cx={center} cy={center} r={radius} fill="none" stroke="var(--color-border)" strokeWidth={strokeWidth} opacity={0.25} />
          {segments.map((seg, i) => (
            <circle
              key={i}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={data[i]!.color ?? PALETTE[i % PALETTE.length]}
              strokeWidth={strokeWidth}
              strokeDasharray={`${seg.dash} ${seg.circumference - seg.dash}`}
              strokeDashoffset={seg.offset}
            />
          ))}
        </g>
        {centerLabel != null && (
          <text x={center} y={center} textAnchor="middle" dominantBaseline="central" className="fill-[var(--color-fg)] text-sm font-semibold tabular-nums">
            {centerLabel}
          </text>
        )}
      </svg>
      {showLegend && (
        <ul className="min-w-0 space-y-1 text-sm">
          {segments.map((seg, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="size-2.5 shrink-0 rounded-sm" style={{ background: data[i]!.color ?? PALETTE[i % PALETTE.length] }} />
              <span className="truncate text-[var(--color-muted)]">{data[i]!.label}</span>
              <span className="ml-auto shrink-0 font-medium tabular-nums">{seg.percent}%</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
