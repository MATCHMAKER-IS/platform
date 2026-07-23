/**
 * 共通 Button。バリアント(primary/secondary/ghost/danger)とサイズを持つ。
 * shadcn/ui の慣習に沿って cva でスタイルを管理する。
 * @packageDocumentation
 */
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-[var(--radius)] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none",
  {
    variants: {
      variant: {
        primary: "bg-[var(--color-primary)] text-[var(--color-primary-fg)] hover:opacity-90",
        secondary: "border border-[var(--color-border)] text-[var(--color-fg)] hover:bg-[var(--color-subtle)]",
        ghost: "text-[var(--color-fg)] hover:bg-[var(--color-subtle-strong)]",
        danger: "bg-[var(--color-danger)] text-white hover:opacity-90",
      },
      // 高さは**最小値**にする。固定(h-*)にすると、中身が増えたときに
      // はみ出した部分が見えなくなる(アイコン + 名前を縦に並べた画面で実際に起きた)。
      // 文字だけのボタンでは見た目は変わらない。
      size: {
        sm: "min-h-7 py-1 px-2.5 text-xs",
        md: "min-h-9 py-1.5 px-3.5 text-sm",
        lg: "min-h-10 py-2 px-5 text-sm",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

/** {@link Button} の props。 */
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

/**
 * 共通ボタン。
 * @example
 * ```tsx
 * <Button variant="primary" onClick={save}>保存する</Button>
 * ```
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
);
Button.displayName = "Button";

export { buttonVariants };
