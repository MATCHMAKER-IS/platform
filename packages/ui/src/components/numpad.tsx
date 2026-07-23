"use client";
/**
 * 共通 NumericKeypad(テンキー)。タッチ端末・キオスク向けの数値入力。
 * @packageDocumentation
 */
import * as React from "react";
import { Delete } from "lucide-react";
import { cn } from "../lib/cn";

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
/**
 * 数字キーパッド(画面上のテンキー)。
 *
 * **タブレットや端末で、キーボードが無い場面**に使う
 * (倉庫の棚卸し、店頭の入力)。パソコンでは邪魔になるので出さない。
 *
 * - `allowDecimal` は既定で不可。個数や本数には小数が要らない
 * - `maxLength` で桁を制限すると、入れ間違いに気づける
 * - 手袋をした指でも押せるよう、ボタンは大きめに保つ
 *
 * @example
 * ```tsx
 * <NumericKeypad value={qty} onChange={setQty} maxLength={4} />
 * ```
 */
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
          className="flex h-14 items-center justify-center rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] text-lg font-medium hover:bg-[var(--color-subtle-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
        >
          {k === "back" ? <Delete className="h-5 w-5" /> : k === "clear" ? "C" : k}
        </button>
      ))}
    </div>
  );
}
