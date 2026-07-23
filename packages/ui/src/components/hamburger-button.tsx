"use client";
/**
 * ハンバーガーボタン。開閉状態でアイコンが切り替わるメニュートグル。
 * モバイルでサイドメニュー/ドロワーを開くのに使う。
 * @packageDocumentation
 */
import * as React from "react";
import { cn } from "../lib/cn";

/** {@link HamburgerButton} の props。 */
export interface HamburgerButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** 開いているか(true で×に変化)。 */
  open?: boolean;
  /** アクセシブルなラベル(既定「メニュー」)。 */
  label?: string;
}

/** ハンバーガーメニューのトグルボタン。 */
export const HamburgerButton = React.forwardRef<HTMLButtonElement, HamburgerButtonProps>(
  ({ open = false, label = "メニュー", className, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      aria-expanded={open}
      className={cn(
        "inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius)] text-[var(--color-fg)] transition-colors hover:bg-[var(--color-subtle-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]",
        className,
      )}
      {...props}
    >
      <span className="relative block h-4 w-5" aria-hidden="true">
        <span className={cn("absolute left-0 block h-0.5 w-5 bg-current transition-all duration-200", open ? "top-1.5 rotate-45" : "top-0")} />
        <span className={cn("absolute left-0 top-1.5 block h-0.5 w-5 bg-current transition-all duration-200", open && "opacity-0")} />
        <span className={cn("absolute left-0 block h-0.5 w-5 bg-current transition-all duration-200", open ? "top-1.5 -rotate-45" : "top-3")} />
      </span>
    </button>
  ),
);
HamburgerButton.displayName = "HamburgerButton";
