"use client";
/**
 * 共通 NumericKeypad(テンキー)。タッチ端末・キオスク向けの数値入力。
 * @packageDocumentation
 */
import * as React from "react";
import { Delete } from "lucide-react";
import { cn } from "../lib/cn.js";

/** {@link NumericKeypad} の props。 */
export interface NumericKeypadProps {
  /** 現在値。 */
  value: string;
  /** 値が変わったとき。 */
  onChange: (value: string) => void;
  /** 小数点キーを表示するか。 */
  allowDecimal?: boolean;
  /** 最大桁数。 */
  maxLength?: number;
  className?: string;
}

/** オンスクリーン数値キーパッド。 */
export function NumericKeypad({ value, onChange, allowDecimal = false, maxLength, className }: NumericKeypadProps) {
  const press = (key: string) => {
    if (key === "back") return onChange(value.slice(0, -1));
    if (key === "clear") return onChange("");
    if (key === "." && (value.includes(".") || value === "")) return;
    if (maxLength && value.replace(".", "").length >= maxLength) return;
    onChange(value + key);
  };

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", allowDecimal ? "." : "clear", "0", "back"];

  return (
    <div className={cn("grid w-56 grid-cols-3 gap-1.5", className)}>
      {keys.map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => press(k)}
          className="flex h-14 items-center justify-center rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] text-lg font-medium hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
        >
          {k === "back" ? <Delete className="h-5 w-5" /> : k === "clear" ? "C" : k}
        </button>
      ))}
    </div>
  );
}
