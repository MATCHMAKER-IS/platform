/**
 * 共通 Badge。ステータス表示等の小さなラベル。
 * @packageDocumentation
 */
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn.js";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "bg-[var(--color-primary)] text-[var(--color-primary-fg)]",
        secondary: "bg-slate-100 text-[var(--color-fg)]",
        success: "bg-emerald-100 text-emerald-700",
        warning: "bg-amber-100 text-amber-700",
        danger: "bg-red-100 text-[var(--color-danger)]",
        outline: "border border-[var(--color-border)] text-[var(--color-fg)]",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

/** {@link Badge} の props。 */
export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

/** ステータスラベル。 */
export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { badgeVariants };
