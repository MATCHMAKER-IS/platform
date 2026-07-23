"use client";
/**
 * メッセージ入力欄。Enter で送信(Shift+Enter で改行)。送信は onSend に委譲。
 * @packageDocumentation
 */
import * as React from "react";
import { cn } from "../lib/cn";

/** {@link MessageComposer} の props。 */
export interface MessageComposerProps {
  /** 送信時。空文字は送られない。 */
  onSend: (text: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

/** メッセージ入力+送信。 */
/**
 * 発言の入力欄。
 *
 * Enter で送るか、改行にするかを決める(**業務では改行を優先**する方が安全)。
 * 送信中は二重送信を防ぐため、押せなくする。
 */
export function MessageComposer({ onSend, placeholder = "メッセージを入力", disabled, className }: MessageComposerProps) {
  const [text, setText] = React.useState("");

  const submit = () => {
    const trimmed = text.trim();
    if (trimmed.length === 0) return;
    onSend(trimmed);
    setText("");
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className={cn("flex items-end gap-2 border-t border-[var(--color-border)] p-3", className)}>
      <textarea
        className="flex-1 resize-none rounded-[var(--radius)] border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
        rows={1}
        value={text}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setText(e.target.value)}
        onKeyDown={onKeyDown}
      />
      <button
        className="rounded-[var(--radius)] bg-[var(--color-primary)] px-4 py-2 text-sm text-white disabled:opacity-40"
        onClick={submit}
        disabled={disabled || text.trim().length === 0}
      >
        送信
      </button>
    </div>
  );
}
