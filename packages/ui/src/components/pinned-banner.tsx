"use client";
/**
 * ピン留めメッセージのバナー。折りたたみ可能で、各ピンをクリックで該当メッセージへ、解除ボタンも出せる。
 * @packageDocumentation
 */
import * as React from "react";
import { cn } from "../lib/cn";

/** バナーに出すピン項目。 */
export interface PinnedItem {
  messageId: string;
  /** 表示テキスト(本文の抜粋)。 */
  text: string;
  /** 固定した人の表示名。 */
  pinnedByName?: string;
}

/** {@link PinnedBanner} の props。 */
export interface PinnedBannerProps {
  items: PinnedItem[];
  /** ピンをクリック(該当メッセージへジャンプ)。 */
  onJump?: (messageId: string) => void;
  /** 解除(ピン留め解除)。 */
  onUnpin?: (messageId: string) => void;
  className?: string;
}

/** ピン留めバナー。 */
/**
 * 上部に固定する告知。
 *
 * システム停止の予告など、**見逃されると困る連絡**に使う。
 * 常時出しておくと背景になるので、期間を決めて外す。
 */
export function PinnedBanner({ items, onJump, onUnpin, className }: PinnedBannerProps) {
  const [open, setOpen] = React.useState(false);
  if (items.length === 0) return null;
  const first = items[0];

  return (
    <div className={cn("rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-muted-bg,#f8f8f8)]", className)}>
      <div className="flex items-center gap-2 px-3 py-2 text-sm">
        <span aria-hidden>📌</span>
        <button className="min-w-0 flex-1 truncate text-left" onClick={() => (items.length > 1 ? setOpen((v) => !v) : first && onJump?.(first.messageId))}>
          <span className="font-medium">ピン留め {items.length}件</span>
          {first && <span className="ml-2 text-[var(--color-muted)]">{first.text}</span>}
        </button>
        {items.length > 1 && (
          <button className="text-xs text-[var(--color-primary)]" onClick={() => setOpen((v) => !v)}>
            {open ? "閉じる" : "すべて表示"}
          </button>
        )}
      </div>
      {open && (
        <ul className="border-t border-[var(--color-border)]">
          {items.map((item) => (
            <li key={item.messageId} className="flex items-center gap-2 px-3 py-2 text-sm">
              <button className="min-w-0 flex-1 truncate text-left" onClick={() => onJump?.(item.messageId)}>
                <span className="truncate">{item.text}</span>
                {item.pinnedByName && <span className="ml-2 text-xs text-[var(--color-muted)]">{item.pinnedByName}</span>}
              </button>
              {onUnpin && (
                <button className="text-xs text-[var(--color-muted)] hover:text-[var(--color-danger,#e11)]" onClick={() => onUnpin(item.messageId)} aria-label="ピン留めを解除">
                  解除
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
