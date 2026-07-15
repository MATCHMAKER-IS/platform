/**
 * 共通 NumberInput。数値入力(min/max/step は標準属性で指定)。
 * @packageDocumentation
 */
import * as React from "react";
import { cn } from "../lib/cn.js";

/** {@link NumberInput} の props。 */
export type NumberInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">;

/** 共通数値入力。 */
export const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      type="number"
      inputMode="numeric"
      className={cn(
        "h-10 w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm text-[var(--color-fg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);
NumberInput.displayName = "NumberInput";
