"use client";
/**
 * CTA（行動喚起）ボタン。強調スタイルのリンク/ボタン。
 * @packageDocumentation
 */
import * as React from "react";
import { cn } from "../lib/cn.js";

/** {@link CtaButton} の props。 */
export interface CtaButtonProps {
  label: string;
  href?: string;
  onClick?: () => void;
  /** 見た目。 */
  variant?: "primary" | "secondary" | "outline";
  size?: "sm" | "md" | "lg";
  /** 全幅にする。 */
  block?: boolean;
  /** 右端のアイコン（例 "→"）。 */
  icon?: React.ReactNode;
  external?: boolean;
  className?: string;
}

const VARIANTS: Record<string, string> = {
  primary: "bg-[var(--color-primary)] text-[var(--color-primary-fg,#fff)] hover:opacity-90",
  secondary: "bg-[var(--color-fg)] text-[var(--color-bg,#fff)] hover:opacity-90",
  outline: "border border-[var(--color-primary)] text-[var(--color-primary)] hover:bg-[var(--color-primary)]/5",
};
const SIZES: Record<string, string> = { sm: "px-3 py-1.5 text-sm", md: "px-5 py-2.5 text-sm", lg: "px-7 py-3 text-base" };

/** CTA ボタン。 */
export function CtaButton({ label, href, onClick, variant = "primary", size = "md", block, icon, external, className }: CtaButtonProps) {
  const cls = cn("inline-flex items-center justify-center gap-2 rounded-[var(--radius)] font-medium transition-opacity", VARIANTS[variant], SIZES[size], block && "w-full", className);
  const content = (
    <>
      {label}
      {icon && <span aria-hidden>{icon}</span>}
    </>
  );
  if (href) {
    return (
      <a href={href} onClick={onClick} className={cls} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
        {content}
      </a>
    );
  }
  return (
    <button onClick={onClick} className={cls}>
      {content}
    </button>
  );
}
