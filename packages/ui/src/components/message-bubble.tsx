"use client";
/**
 * チャットの吹き出し。自分の発言は右寄せ、他者は左寄せ+名前。chat パッケージ非依存。
 * @packageDocumentation
 */
import * as React from "react";
import { linkify } from "@platform/html";
import { cn } from "../lib/cn.js";

/** {@link MessageBubble} の props。 */
export interface MessageBubbleProps {
  /** 本文。 */
  text: string;
  /** URL を自動リンク化する（既定 true・XSS 安全）。 */
  renderLinks?: boolean;
  /** 送信者の表示名(他者のみ表示)。 */
  authorName?: string;
  /** 時刻表示(例 "10:23")。 */
  timestamp?: string;
  /** 自分の発言なら右寄せ・強調色。 */
  own?: boolean;
  /** 編集済み表示。 */
  edited?: boolean;
  className?: string;
}

/** メッセージの吹き出し。 */
export function MessageBubble({ text, authorName, timestamp, own, edited, renderLinks = true, className }: MessageBubbleProps) {
  return (
    <div className={cn("flex flex-col gap-0.5", own ? "items-end" : "items-start", className)}>
      {!own && authorName && <span className="px-1 text-xs text-[var(--color-muted)]">{authorName}</span>}
      <div
        className={cn("max-w-[75%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words [&_a]:underline", own ? "bg-[var(--color-primary)] text-white" : "bg-[var(--color-muted-bg,#f1f1f1)] text-[var(--color-fg)]")}
        {...(renderLinks ? { dangerouslySetInnerHTML: { __html: linkify(text) } } : {})}
      >
        {renderLinks ? null : text}
      </div>
      <span className="px-1 text-[10px] text-[var(--color-muted)]">
        {timestamp}{edited ? "（編集済み）" : ""}
      </span>
    </div>
  );
}
