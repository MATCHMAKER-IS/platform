"use client";
/**
 * 目標達成バー。実績と目標を比較し、達成率とターゲットマーカーを表示する。
 * @packageDocumentation
 */
import { cn } from "../lib/cn";
import { achievementRate } from "../lib/dashboard";

/** {@link GoalProgress} の props。 */
export interface GoalProgressProps {
  label?: React.ReactNode;
  /** 実績値。 */
  actual: number;
  /** 目標値。 */
  target: number;
  /** 値の整形(既定は桁区切り)。 */
  format?: (n: number) => string;
  className?: string;
}

const defaultFormat = (n: number) => n.toLocaleString("ja-JP");

/** 目標達成バー。達成率で色が変わり(100%以上は緑)、目標位置にマーカーを表示。 */
/**
 * 目標に対する進み。
 *
 * 達成率だけでなく**残りと期限**を出す。
 * 「80%」より「あと 3 件・今週まで」の方が動ける。
 */
export function GoalProgress({ label, actual, target, format = defaultFormat, className }: GoalProgressProps) {
  const rate = achievementRate(actual, target);
  const reached = rate >= 100;
  // バーは目標を超えても振り切らないよう、目標を 100% 位置とし実績はそれ以上でも満杯表示
  const fillPct = Math.min(100, rate);
  const color = reached ? "#16a34a" : rate >= 70 ? "var(--color-primary)" : "#f59e0b";
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        {label != null && <span className="text-[var(--color-muted)]">{label}</span>}
        <span className="ml-auto tabular-nums">
          <span className="font-semibold">{format(actual)}</span>
          <span className="text-[var(--color-muted)]"> / {format(target)}</span>
        </span>
        <span className={cn("shrink-0 font-semibold tabular-nums", reached ? "text-green-600" : "text-[var(--color-fg)]")}>{rate}%</span>
      </div>
      <div className="relative h-2.5 overflow-hidden rounded-full bg-[var(--color-border)]/40">
        <div className="h-full rounded-full transition-[width]" style={{ width: `${fillPct}%`, background: color }} />
      </div>
    </div>
  );
}
