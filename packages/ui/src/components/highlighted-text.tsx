"use client";
/**
 * 検索語をハイライト表示するテキスト。一致部分を <mark> で強調する。
 * @packageDocumentation
 */
import * as React from "react";
import { cn } from "../lib/cn";
import { highlightSegments } from "../lib/highlight";

/** {@link HighlightedText} の props。 */
export interface HighlightedTextProps {
  text: string;
  /** 強調する検索語(空白区切り)。 */
  query: string;
  className?: string;
}

/** 検索語を強調したテキスト。 */
export function HighlightedText({ text, query, className }: HighlightedTextProps) {
  const segments = highlightSegments(text, query);
  return (
    <span className={className}>
      {segments.map((seg, i) =>
        seg.highlight ? (
          <mark key={i} className={cn("rounded-sm bg-[var(--color-warning-bg,#fef08a)] px-0.5 text-[var(--color-fg)]")}>
            {seg.text}
          </mark>
        ) : (
          <React.Fragment key={i}>{seg.text}</React.Fragment>
        ),
      )}
    </span>
  );
}
