"use client";
/**
 * 数値サマリーカード。ダッシュボードの指標表示に使う。
 * @packageDocumentation
 */
import * as React from "react";
import { cn } from "../lib/cn";

/** {@link StatCard} の props。 */
export interface StatCardProps {
  label: string;
  value: React.ReactNode;
  /** 補足（単位や説明）。 */
  hint?: string;
  /** アイコン等（絵文字でも可）。 */
  icon?: React.ReactNode;
  href?: string;
  className?: string;
}

/** サマリーカード。 */
export function StatCard({ label, value, hint, icon, href, className }: StatCardProps) {
  const inner = (
    <div className={cn("flex items-center gap-3 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg,#fff)] px-4 py-3", className)}>
      {icon && <div className="text-2xl" aria-hidden>{icon}</div>}
      <div className="min-w-0">
        <div className="text-xs text-[var(--color-muted)]">{label}</div>
        <div className="text-2xl font-semibold leading-tight">{value}</div>
        {hint && <div className="text-xs text-[var(--color-muted)]">{hint}</div>}
      </div>
    </div>
  );
  return href ? <a href={href} className="block hover:opacity-80">{inner}</a> : inner;
}
