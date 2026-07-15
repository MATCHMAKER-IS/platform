"use client";
/**
 * 共通 OTPInput。認証コード等の桁区切り入力(自動送り・貼り付け対応)。
 * @packageDocumentation
 */
import * as React from "react";
import { cn } from "../lib/cn.js";

/** {@link OTPInput} の props。 */
export interface OTPInputProps {
  /** 桁数(既定 6)。 */
  length?: number;
  /** 現在値。 */
  value: string;
  /** 変更時(全桁の文字列)。 */
  onChange: (value: string) => void;
  /** 全桁入力が揃ったとき。 */
  onComplete?: (value: string) => void;
  className?: string;
}

/** 桁区切りのワンタイムコード入力。 */
export function OTPInput({ length = 6, value, onChange, onComplete, className }: OTPInputProps) {
  const refs = React.useRef<(HTMLInputElement | null)[]>([]);
  const chars = value.padEnd(length, " ").slice(0, length).split("");

  const setChar = (i: number, ch: string) => {
    const digit = ch.replace(/\D/g, "").slice(-1);
    const arr = value.padEnd(length, " ").split("");
    arr[i] = digit || " ";
    const next = arr.join("").replace(/\s+$/g, "");
    onChange(next.trimEnd());
    if (digit && i < length - 1) refs.current[i + 1]?.focus();
    const joined = arr.join("").trim();
    if (joined.length === length && !joined.includes(" ")) onComplete?.(joined);
  };

  return (
    <div className={cn("flex gap-2", className)}>
      {chars.map((c, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          inputMode="numeric"
          maxLength={1}
          value={c.trim()}
          onChange={(e) => setChar(i, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !c.trim() && i > 0) refs.current[i - 1]?.focus();
          }}
          onPaste={(e) => {
            e.preventDefault();
            const digits = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
            onChange(digits);
            if (digits.length === length) onComplete?.(digits);
          }}
          className="h-12 w-10 rounded-[var(--radius)] border border-[var(--color-border)] text-center text-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
        />
      ))}
    </div>
  );
}
