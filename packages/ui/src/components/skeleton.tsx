/**
 * 共通 Skeleton。読み込み中のプレースホルダ。
 * @packageDocumentation
 */
import * as React from "react";
import { cn } from "../lib/cn.js";

/** ローディングプレースホルダ(幅・高さは className で指定)。 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-[var(--radius)] bg-slate-200", className)} {...props} />;
}
