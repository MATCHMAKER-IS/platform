"use client";
/**
 * トレンド(前期比)バッジ。増減を矢印と色で表す。
 * @packageDocumentation
 */
import { percentChange } from "@platform/utils";
import { cn } from "../lib/cn";

/** {@link Trend} の props。 */
export interface TrendProps {
  current: number;
  previous: number;
  /** 増加を良し(緑)とするか。コスト系は false に。 */
  higherIsBetter?: boolean;
  /** 小数桁(既定 1)。 */
  decimals?: number;
  className?: string;
}

/** 前期比バッジ。 */
/**
 * 増減の表示(前と比べてどうか)。
 *
 * 数値の横に置いて、上向き・下向きと差分を示す。
 * **増加が良いとは限らない**(費用・離職率・障害件数)。
 * 良し悪しの向きを指定できる場合は、指標に合わせて必ず設定する。
 */
export function Trend({ current, previous, higherIsBetter = true, decimals = 1, className }: TrendProps) {
  const pct = percentChange(previous, current);
  const flat = !Number.isFinite(pct) || Math.abs(pct) < 0.05;
  const up = pct > 0;
  const good = flat ? false : up === higherIsBetter;
  const arrow = flat ? "→" : up ? "▲" : "▼";
  const color = flat ? "text-[var(--color-muted)]" : good ? "text-green-600" : "text-red-600";
  const text = flat || !Number.isFinite(pct) ? "±0%" : `${up ? "+" : ""}${pct.toFixed(decimals)}%`;
  return <span className={cn("inline-flex items-center gap-0.5 text-sm font-medium tabular-nums", color, className)}>{arrow}{text}</span>;
}
