"use client";
/**
 * ダッシュボード用グリッドレイアウト。12 カラム(既定)のグリッドに、桁数を指定した
 * ウィジェットを並べる。狭い画面では自動的に 1 カラムに折り返す。
 * @packageDocumentation
 */
import * as React from "react";
import { cn } from "../lib/cn";
import { useI18n } from "./i18n-provider";

/** {@link DashboardGrid} の props。 */
export interface DashboardGridProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  /** グリッドのカラム数(既定 12)。 */
  columns?: number;
  /** ウィジェット間の間隔(px、既定 16)。 */
  gap?: number;
}

/** ダッシュボードのグリッド枠。`.platform-dashboard`(tokens.css)で狭幅時に 1 カラム化。 */
export function DashboardGrid({ columns = 12, gap = 16, className, style, children, ...props }: DashboardGridProps) {
  return (
    <div
      className={cn("platform-dashboard", className)}
      style={{ ["--dash-cols" as string]: String(columns), gap, ...style }}
      {...props}
    >
      {children}
    </div>
  );
}

/** {@link DashboardWidget} の props。 */
export interface DashboardWidgetProps extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  title?: React.ReactNode;
  /** 横に占めるカラム数(既定 12 = 全幅)。 */
  colSpan?: number;
  /** 縦に占める行数。 */
  rowSpan?: number;
  /** ヘッダ右側の操作要素(ボタン等)。 */
  actions?: React.ReactNode;
  /** 枠・余白を付けない(グラフ等を直接置く場合)。 */
  bare?: boolean;
}

/** ダッシュボードのウィジェット(タイル)。`colSpan` で幅を指定。 */
export function DashboardWidget({ title, colSpan = 12, rowSpan, actions, bare, className, style, children, ...props }: DashboardWidgetProps) {
  return (
    <section
      className={cn(!bare && "rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4", className)}
      style={{ gridColumn: `span ${colSpan}`, gridRow: rowSpan ? `span ${rowSpan}` : undefined, ...style }}
      {...props}
    >
      {(title || actions) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-[var(--color-fg)]">{title}</h3>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

/** 数値を大きく見せる KPI カード(ダッシュボード定番)。 */
export interface StatCardProps {
  label: React.ReactNode;
  value: React.ReactNode;
  /** value が数値のときロケール連動で整形。 */
  format?: "currency" | "number";
  /** currency 時の通貨コード(既定 JPY)。 */
  currency?: string;
  /** 前期比などの補足(例: "+12%")。 */
  delta?: React.ReactNode;
  /** delta の方向で色付け。 */
  trend?: "up" | "down" | "flat";
  icon?: React.ReactNode;
  className?: string;
}

/** KPI 表示カード。 */
export function StatCard({ label, value, format, currency, delta, trend = "flat", icon, className }: StatCardProps) {
  const i18n = useI18n();
  const displayValue = typeof value === "number" && format
    ? (format === "currency" ? i18n.currency(value, currency ?? "JPY") : i18n.n(value))
    : value;
  const trendColor = trend === "up" ? "text-emerald-600" : trend === "down" ? "text-red-600" : "text-[var(--color-muted)]";
  return (
    <div className={cn("rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4", className)}>
      <div className="flex items-center justify-between">
        <span className="text-sm text-[var(--color-muted)]">{label}</span>
        {icon && <span className="text-[var(--color-primary)]">{icon}</span>}
      </div>
      <div className="mt-1 text-2xl font-bold text-[var(--color-fg)]">{displayValue}</div>
      {delta != null && <div className={cn("mt-1 text-xs font-medium", trendColor)}>{delta}</div>}
    </div>
  );
}
