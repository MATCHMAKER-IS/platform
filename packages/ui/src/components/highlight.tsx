"use client";
/**
 * 検索語に一致した箇所を強調表示する。`@platform/utils` の highlight を使用。
 * @packageDocumentation
 */
import { highlight, highlightTerms } from "@platform/utils";
import { cn } from "../lib/cn";

/** {@link Highlight} の props。 */
export interface HighlightProps {
  text: string;
  query: string;
  /** 大文字小文字を区別する。 */
  caseSensitive?: boolean;
  className?: string;
  /** 一致部分(mark)のクラス。 */
  markClassName?: string;
  /** 空白区切りで各語を個別にハイライトする。 */
  multiWord?: boolean;
}

/** 検索語ハイライト。 */
export function Highlight({ text, query, caseSensitive, className, markClassName, multiWord }: HighlightProps) {
  const segments = multiWord ? highlightTerms(text, query, { caseSensitive }) : highlight(text, query, { caseSensitive });
  if (segments.length === 0) return null;
  return (
    <span className={className}>
      {segments.map((s, i) =>
        s.match ? (
          <mark key={i} className={cn("rounded bg-yellow-200 px-0.5 text-inherit", markClassName)}>{s.text}</mark>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </span>
  );
}
