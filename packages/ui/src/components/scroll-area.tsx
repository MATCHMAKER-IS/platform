"use client";
/**
 * スクロールエリア。長い本文(利用規約・プライバシーポリシー等)を枠内でスクロール表示する。
 * 最下部までスクロールしたら onReachBottom を呼ぶ(規約の読了判定などに使う)。
 * @packageDocumentation
 */
import * as React from "react";
import { cn } from "../lib/cn";

/** {@link ScrollArea} の props。 */
export interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 最大の高さ(既定 "16rem")。これを超えるとスクロールする。 */
  maxHeight?: string;
  /** 最下部(近く)までスクロールしたときに一度呼ばれる。 */
  onReachBottom?: () => void;
  /** 最下部判定の余白(px。既定 8)。 */
  threshold?: number;
}

/** 枠内スクロール表示のコンテナ。 */
/**
 * 独自の枠内スクロール。
 *
 * 画面全体ではなく、**一部だけを縦に長くしたい**ときに使う。
 * 中身が隠れていることが分かるよう、端で切れて見えるようにする。
 */
export const ScrollArea = React.forwardRef<HTMLDivElement, ScrollAreaProps>(
  ({ maxHeight = "16rem", onReachBottom, threshold = 8, className, style, onScroll, children, ...props }, ref) => {
    const reachedRef = React.useRef(false);

    function handleScroll(e: React.UIEvent<HTMLDivElement>) {
      onScroll?.(e);
      const el = e.currentTarget;
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
      if (atBottom && !reachedRef.current) {
        reachedRef.current = true;
        onReachBottom?.();
      }
    }

    return (
      <div
        ref={ref}
        onScroll={handleScroll}
        style={{ maxHeight, ...style }}
        className={cn(
          "overflow-y-auto rounded-[var(--radius)] border border-[var(--color-border)] bg-white p-4 text-sm leading-relaxed text-[var(--color-fg)]",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  },
);
ScrollArea.displayName = "ScrollArea";

/** 最下部までスクロールしたかを追跡するフック(手動制御用)。 */
export function useScrolledToBottom(): [boolean, (e: React.UIEvent<HTMLDivElement>) => void] {
  const [reached, setReached] = React.useState(false);
  const onScroll = React.useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight <= 8) setReached(true);
  }, []);
  return [reached, onScroll];
}
