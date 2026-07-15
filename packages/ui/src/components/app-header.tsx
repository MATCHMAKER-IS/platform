"use client";
/**
 * アプリヘッダー(トップバー)。左にロゴ/ハンバーガー、中央にナビ、右にアクション。
 * AppShell の header スロットに入れて使える。
 * @packageDocumentation
 */
import * as React from "react";
import { cn } from "../lib/cn.js";
import { isNavActive, type NavItem } from "../lib/nav.js";

/** {@link AppHeader} の props。 */
export interface AppHeaderProps extends React.HTMLAttributes<HTMLElement> {
  /** ロゴ/ブランド(左端)。 */
  logo?: React.ReactNode;
  /** 中央のナビ(HeaderNav 等)。 */
  nav?: React.ReactNode;
  /** 右端のアクション(ボタン・ユーザーメニュー等)。 */
  actions?: React.ReactNode;
  /** 左端の先頭要素(モバイルのハンバーガー等)。 */
  leading?: React.ReactNode;
  /** 上部に固定する。 */
  sticky?: boolean;
}

/** アプリのトップバー。 */
export const AppHeader = React.forwardRef<HTMLElement, AppHeaderProps>(
  ({ logo, nav, actions, leading, sticky = false, className, ...props }, ref) => (
    <header
      ref={ref}
      className={cn(
        "flex h-14 items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-bg)] px-4",
        sticky && "sticky top-0 z-30",
        className,
      )}
      {...props}
    >
      {leading}
      {logo != null && <div className="flex shrink-0 items-center">{logo}</div>}
      {nav != null && <nav className="ml-2 hidden md:flex">{nav}</nav>}
      <div className="ml-auto flex items-center gap-2">{actions}</div>
    </header>
  ),
);
AppHeader.displayName = "AppHeader";

/** {@link HeaderNav} の props。 */
export interface HeaderNavProps {
  items: NavItem[];
  /** 現在のパス(アクティブ表示に使う)。 */
  currentPath?: string;
  className?: string;
}

/** ヘッダー用の横並びナビ。 */
export function HeaderNav({ items, currentPath = "", className }: HeaderNavProps) {
  return (
    <ul className={cn("flex items-center gap-1", className)}>
      {items.map((item) => {
        const active = isNavActive(item.href, currentPath);
        return (
          <li key={item.href}>
            <a
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-[var(--radius)] px-3 py-2 text-sm font-medium transition-colors",
                active ? "bg-slate-100 text-[var(--color-fg)]" : "text-[var(--color-muted)] hover:bg-slate-50 hover:text-[var(--color-fg)]",
              )}
            >
              {item.label}
              {item.badge != null && (
                <span className="rounded-full bg-[var(--color-primary)] px-1.5 py-0.5 text-xs text-[var(--color-primary-fg)]">{item.badge}</span>
              )}
            </a>
          </li>
        );
      })}
    </ul>
  );
}
