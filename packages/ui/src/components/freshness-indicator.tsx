"use client";
/**
 * データ鮮度インジケータ。最終更新からの相対時刻を表示し、古いと色で警告する。
 * ダッシュボードの「最終更新: 5分前」表示に。
 * @packageDocumentation
 */
import { cn } from "../lib/cn";
import { relativeTime } from "../lib/dashboard";

/** {@link FreshnessIndicator} の props。 */
export interface FreshnessIndicatorProps {
  /** 最終更新時刻(エポックミリ秒 or Date)。 */
  updatedAt: number | Date;
  /** 現在時刻(テスト用。既定は now)。 */
  now?: number;
  /** この分数を超えたら警告色にする(既定 60)。 */
  staleAfterMinutes?: number;
  /** 接頭ラベル(既定「最終更新」)。 */
  label?: string;
  className?: string;
}

/** 最終更新の相対時刻を表示する。古い場合は警告色。 */
export function FreshnessIndicator({ updatedAt, now = Date.now(), staleAfterMinutes = 60, label = "最終更新", className }: FreshnessIndicatorProps) {
  const ms = updatedAt instanceof Date ? updatedAt.getTime() : updatedAt;
  const stale = now - ms > staleAfterMinutes * 60_000;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs", stale ? "text-amber-600" : "text-[var(--color-muted)]", className)}>
      <span className={cn("size-1.5 rounded-full", stale ? "bg-amber-500" : "bg-green-500")} aria-hidden />
      <span>{label}: {relativeTime(ms, now)}</span>
    </span>
  );
}
