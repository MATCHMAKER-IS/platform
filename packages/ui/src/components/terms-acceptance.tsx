"use client";
/**
 * 利用規約の同意 UI。規約本文をスクロールエリアで表示し、
 * 最下部まで読んだら同意チェックを有効化する(read-before-agree パターン)。
 * @packageDocumentation
 */
import * as React from "react";
import { cn } from "../lib/cn.js";
import { ScrollArea } from "./scroll-area.js";

/** {@link TermsAcceptance} の props。 */
export interface TermsAcceptanceProps {
  /** 規約本文(テキストまたは任意の要素)。 */
  children: React.ReactNode;
  /** 同意チェックのラベル(既定「上記の利用規約に同意します」)。 */
  label?: string;
  /** 最後まで読むまで同意させない(既定 true)。 */
  requireScroll?: boolean;
  /** 同意状態が変わったとき。 */
  onAcceptedChange?: (accepted: boolean) => void;
  /** スクロールエリアの高さ。 */
  maxHeight?: string;
  className?: string;
}

/** 規約を表示し、読了後に同意できるコンポーネント。 */
export function TermsAcceptance({ children, label = "上記の利用規約に同意します", requireScroll = true, onAcceptedChange, maxHeight, className }: TermsAcceptanceProps) {
  const [readToEnd, setReadToEnd] = React.useState(!requireScroll);
  const [accepted, setAccepted] = React.useState(false);

  const canAgree = readToEnd;

  function toggle(next: boolean) {
    if (!canAgree) return;
    setAccepted(next);
    onAcceptedChange?.(next);
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <ScrollArea maxHeight={maxHeight} onReachBottom={() => setReadToEnd(true)}>
        {children}
      </ScrollArea>

      {requireScroll && !readToEnd && (
        <p className="text-xs text-[var(--color-muted)]">最後までスクロールすると同意できます。</p>
      )}

      <label className={cn("flex items-center gap-2 text-sm", !canAgree && "opacity-50")}>
        <input
          type="checkbox"
          checked={accepted}
          disabled={!canAgree}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => toggle(e.target.checked)}
          className="size-4 rounded border-[var(--color-border)]"
        />
        <span>{label}</span>
      </label>
    </div>
  );
}
