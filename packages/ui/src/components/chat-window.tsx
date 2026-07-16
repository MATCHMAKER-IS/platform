"use client";
/**
 * チャット画面の枠。ヘッダ + メッセージ一覧 + 入力欄を縦に並べる。
 * @packageDocumentation
 */
import * as React from "react";
import { cn } from "../lib/cn";
import { MessageList, type MessageGroup } from "./message-list";
import { MessageComposer } from "./message-composer";

/** {@link ChatWindow} の props。 */
export interface ChatWindowProps {
  /** ルーム名などのタイトル。 */
  title: string;
  /** 補助情報(メンバー数など)。 */
  subtitle?: string;
  groups: MessageGroup[];
  firstUnreadId?: string;
  onSend: (text: string) => void;
  disabled?: boolean;
  className?: string;
}

/** チャットウィンドウ(ヘッダ+一覧+入力)。 */
export function ChatWindow({ title, subtitle, groups, firstUnreadId, onSend, disabled, className }: ChatWindowProps) {
  return (
    <div className={cn("flex h-full flex-col rounded-[var(--radius)] border border-[var(--color-border)]", className)}>
      <div className="border-b border-[var(--color-border)] px-4 py-3">
        <div className="font-semibold">{title}</div>
        {subtitle && <div className="text-xs text-[var(--color-muted)]">{subtitle}</div>}
      </div>
      <MessageList groups={groups} firstUnreadId={firstUnreadId} className="flex-1" />
      <MessageComposer onSend={onSend} disabled={disabled} />
    </div>
  );
}
