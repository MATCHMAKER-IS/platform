/**
 * 共通 Skeleton。読み込み中のプレースホルダ。
 * @packageDocumentation
 */
import * as React from "react";
import { cn } from "../lib/cn";

/** ローディングプレースホルダ(幅・高さは className で指定)。 */
/**
 * 読み込み中の枠(内容の形だけ先に出す)。
 *
 * 空白のまま待たせるより、**何が出てくるか**が分かる方が待ちやすい。
 * ただし読み込みが 1 秒未満なら、かえってちらついて見える。
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-[var(--radius)] bg-[var(--color-subtle-strong)]", className)} {...props} />;
}
