/**
 * 共通 NumberInput。数値入力(min/max/step は標準属性で指定)。
 * @packageDocumentation
 */
import * as React from "react";
import { cn } from "../lib/cn";

/** {@link NumberInput} の props。 */
export type NumberInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">;

/** 共通数値入力。 */
/**
 * 数値の入力(増減ボタンつき)。
 *
 * 金額・数量のように**数として扱う値**に使う。電話番号や郵便番号は
 * 数値ではないので `Input` を使う(先頭の 0 が消える・増減の意味が無い)。
 *
 * - `min` / `max` を付けて、そもそも不正な値を入れられないようにする
 * - 金額なら `step` を 1 に(小数を入れさせない)
 * - 単位は入力欄の外に置く。中に入れると値と混ざる
 *
 * @example
 * ```tsx
 * <NumberInput value={qty} min={1} max={99} step={1}
 *   onChange={(e) => setQty(Number(e.target.value))} />
 * ```
 */
export const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      type="number"
      inputMode="numeric"
      className={cn(
        "h-9 w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm text-[var(--color-fg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);
NumberInput.displayName = "NumberInput";
