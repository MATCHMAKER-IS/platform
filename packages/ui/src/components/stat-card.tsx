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

/**
 * 数値を 1 つ見せるカード。
 *
 * **今どうなっているか**を一目で伝えるためのもの。細かい内訳は表に任せる。
 *
 * - `label` は何の数字かを短く(「今月の売上」)
 * - `value` は数値だけにする。単位は `hint` へ回すと数字が読みやすい
 * - `href` を渡すと押せるようになる。**押した先に明細がある**ときだけ付ける
 *   (押せそうなのに何も起きないのが最も分かりにくい)
 *
 * @example
 * ```tsx
 * <StatCard label="未承認の申請" value={12} hint="件（3 件は期限切れ）" href="/expenses" />
 * <StatCard label="今月の売上" value="1,240,000" hint="円" icon="💰" />
 * ```
 */
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
