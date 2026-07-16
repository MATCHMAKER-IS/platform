"use client";
/**
 * コピーライト表記。@platform/site の copyrightText で文字列を生成して表示する。
 * @packageDocumentation
 */
import * as React from "react";
import { cn } from "../lib/cn";

/** {@link CopyrightNotice} の props。 */
export interface CopyrightNoticeProps {
  holder: string;
  startYear?: number;
  symbol?: string;
  rightsText?: string;
  className?: string;
}

/** 開始年〜現在年のコピーライトを組み立てる（UI 内で完結させる簡易版）。 */
function build(holder: string, startYear: number | undefined, symbol: string, rightsText?: string): string {
  const year = new Date().getFullYear();
  const range = startYear && startYear < year ? `${startYear}–${year}` : String(startYear ?? year);
  const base = `${symbol} ${range} ${holder}`;
  return rightsText ? `${base}. ${rightsText}` : base;
}

/** コピーライト表記。 */
export function CopyrightNotice({ holder, startYear, symbol = "©", rightsText, className }: CopyrightNoticeProps) {
  return <p className={cn("text-xs text-[var(--color-muted)]", className)}>{build(holder, startYear, symbol, rightsText)}</p>;
}
