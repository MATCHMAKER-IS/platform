"use client";
/**
 * メッセージ一覧。日付区切りと未読ラインを描画し、各メッセージを吹き出しで表示する。
 * データ整形は呼び出し側(@platform/chat の groupByDate 等)で行い、ここは表示に徹する。
 * @packageDocumentation
 */
import * as React from "react";
import { cn } from "../lib/cn.js";
import { MessageBubble } from "./message-bubble.js";

/** 表示用メッセージ。 */
export interface DisplayMessage {
  id: string;
  text: string;
  authorName?: string;
  timestamp?: string;
  own?: boolean;
  edited?: boolean;
}

/** 日付グループ。 */
export interface MessageGroup {
  date: string;
  messages: DisplayMessage[];
}

/** {@link MessageList} の props。 */
export interface MessageListProps {
  /** 日付ごとにグループ化されたメッセージ。 */
  groups: MessageGroup[];
  /** ここから未読、という区切りを入れるメッセージ ID。 */
  firstUnreadId?: string;
  className?: string;
}

/** メッセージ一覧(日付区切り・未読ライン付き)。 */
export function MessageList({ groups, firstUnreadId, className }: MessageListProps) {
  return (
    <div className={cn("flex flex-col gap-4 overflow-y-auto p-4", className)}>
      {groups.map((group) => (
        <div key={group.date} className="flex flex-col gap-2">
          <div className="flex items-center justify-center">
            <span className="rounded-full bg-[var(--color-muted-bg,#f1f1f1)] px-3 py-0.5 text-xs text-[var(--color-muted)]">{group.date}</span>
          </div>
          {group.messages.map((m) => (
            <React.Fragment key={m.id}>
              {firstUnreadId === m.id && (
                <div className="flex items-center gap-2 py-1">
                  <div className="h-px flex-1 bg-[var(--color-danger,#e11)]" />
                  <span className="text-[10px] text-[var(--color-danger,#e11)]">ここから未読</span>
                  <div className="h-px flex-1 bg-[var(--color-danger,#e11)]" />
                </div>
              )}
              <MessageBubble text={m.text} authorName={m.authorName} timestamp={m.timestamp} own={m.own} edited={m.edited} />
            </React.Fragment>
          ))}
        </div>
      ))}
    </div>
  );
}
