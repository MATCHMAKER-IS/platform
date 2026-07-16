/**
 * 共通 Input。トークンで枠線・角丸・フォーカスリングを統一する。
 * @packageDocumentation
 */
import * as React from "react";
import { cn } from "../lib/cn";

/** {@link Input} の props。 */
export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

/**
 * 共通テキスト入力。
 * @example
 * ```tsx
 * <Input placeholder="氏名" value={name} onChange={(e) => setName(e.target.value)} />
 * ```
 */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        "h-10 w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
