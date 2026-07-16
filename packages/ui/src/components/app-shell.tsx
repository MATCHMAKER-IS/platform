/**
 * 共通 AppShell。ヘッダ + サイドバー + 本文の基本レイアウト。
 * サイドバーは折りたたみ可能。内部に SidebarNav でナビ項目を並べる。
 * @packageDocumentation
 */
import * as React from "react";
import { cn } from "../lib/cn";

/** {@link AppShell} の props。 */
export interface AppShellProps extends React.HTMLAttributes<HTMLDivElement> {
  /** ヘッダ内容。 */
  header?: React.ReactNode;
  /** サイドバー内容(SidebarNav 等)。 */
  sidebar?: React.ReactNode;
  /** サイドバーを折りたたむ。 */
  sidebarCollapsed?: boolean;
  /** サイドバー幅(既定 "16rem")。 */
  sidebarWidth?: string;
}

/** アプリの外枠レイアウト(ヘッダ固定・サイドバー + 本文)。 */
export function AppShell({ header, sidebar, sidebarCollapsed, sidebarWidth = "16rem", className, children, ...props }: AppShellProps) {
  return (
    <div className={cn("flex min-h-screen flex-col bg-[var(--color-bg)] text-[var(--color-fg)]", className)} {...props}>
      {header && (
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-bg)] px-4">
          {header}
        </header>
      )}
      <div className="flex flex-1">
        {sidebar && (
          <aside
            className={cn(
              "shrink-0 overflow-y-auto border-r border-[var(--color-border)] transition-[width] duration-200",
              sidebarCollapsed ? "w-0 overflow-hidden" : "",
            )}
            style={sidebarCollapsed ? undefined : { width: sidebarWidth }}
          >
            <nav className="p-3">{sidebar}</nav>
          </aside>
        )}
        <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}

/** {@link SidebarNav} の 1 項目。 */
export interface SidebarNavItem {
  label: React.ReactNode;
  href?: string;
  icon?: React.ReactNode;
  /** アクティブ表示。 */
  active?: boolean;
  /** クリック時(href の代わり・SPA ルータ用)。 */
  onClick?: () => void;
  /** バッジ(件数など)。 */
  badge?: React.ReactNode;
}

/** {@link SidebarNav} の props。 */
export interface SidebarNavProps extends React.HTMLAttributes<HTMLUListElement> {
  items: SidebarNavItem[];
}

/** サイドバーのナビ一覧。 */
export function SidebarNav({ items, className, ...props }: SidebarNavProps) {
  return (
    <ul className={cn("flex flex-col gap-0.5", className)} {...props}>
      {items.map((item, i) => {
        const inner = (
          <>
            {item.icon && <span className="shrink-0">{item.icon}</span>}
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            {item.badge != null && <span className="shrink-0 text-xs text-[var(--color-muted)]">{item.badge}</span>}
          </>
        );
        const cls = cn(
          "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm hover:bg-slate-100",
          item.active && "bg-slate-100 font-medium text-[var(--color-primary)]",
        );
        return (
          <li key={i}>
            {item.href ? (
              <a href={item.href} className={cls} aria-current={item.active ? "page" : undefined}>{inner}</a>
            ) : (
              <button type="button" onClick={item.onClick} className={cn(cls, "w-full text-left")} aria-current={item.active ? "page" : undefined}>{inner}</button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
