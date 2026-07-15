"use client";
/**
 * ナビメニュー(縦型)。サイドメニューやモバイルドロワーの中身に使う。
 * 入れ子・アクティブ表示・バッジ・アイコンに対応。
 * @packageDocumentation
 */
import * as React from "react";
import { cn } from "../lib/cn.js";
import { isNavActive, hasActiveChild, type NavItem } from "../lib/nav.js";

/** {@link NavMenu} の props。 */
export interface NavMenuProps {
  items: NavItem[];
  /** 現在のパス(アクティブ表示)。 */
  currentPath?: string;
  /** 項目クリック時(モバイルで閉じる等)。 */
  onNavigate?: (item: NavItem) => void;
  className?: string;
}

/** 縦型のナビメニュー。 */
export function NavMenu({ items, currentPath = "", onNavigate, className }: NavMenuProps) {
  return (
    <ul className={cn("flex flex-col gap-0.5", className)}>
      {items.map((item) => (
        <NavMenuNode key={item.href} item={item} currentPath={currentPath} onNavigate={onNavigate} depth={0} />
      ))}
    </ul>
  );
}

function NavMenuNode({ item, currentPath, onNavigate, depth }: { item: NavItem; currentPath: string; onNavigate?: (item: NavItem) => void; depth: number }) {
  const active = isNavActive(item.href, currentPath);
  const [open, setOpen] = React.useState(hasActiveChild(item, currentPath));
  const hasChildren = !!item.children && item.children.length > 0;

  return (
    <li>
      <div className="flex items-center">
        <a
          href={item.href}
          aria-current={active ? "page" : undefined}
          aria-disabled={item.disabled}
          onClick={() => onNavigate?.(item)}
          style={{ paddingLeft: `${0.75 + depth * 0.75}rem` }}
          className={cn(
            "flex flex-1 items-center gap-2.5 rounded-[var(--radius)] py-2 pr-3 text-sm transition-colors",
            active ? "bg-slate-100 font-medium text-[var(--color-fg)]" : "text-[var(--color-muted)] hover:bg-slate-50 hover:text-[var(--color-fg)]",
            item.disabled && "pointer-events-none opacity-50",
          )}
        >
          {item.icon != null && <span className="shrink-0 text-[var(--color-muted)]">{item.icon as React.ReactNode}</span>}
          <span className="flex-1 truncate">{item.label}</span>
          {item.badge != null && (
            <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-xs text-[var(--color-fg)]">{item.badge}</span>
          )}
        </a>
        {hasChildren && (
          <button
            type="button"
            aria-label={open ? "折りたたむ" : "展開"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="mr-1 flex h-7 w-7 items-center justify-center rounded text-[var(--color-muted)] hover:bg-slate-100"
          >
            <span className={cn("transition-transform", open && "rotate-90")} aria-hidden="true">›</span>
          </button>
        )}
      </div>
      {hasChildren && open && (
        <ul className="mt-0.5 flex flex-col gap-0.5">
          {item.children!.map((child) => (
            <NavMenuNode key={child.href} item={child} currentPath={currentPath} onNavigate={onNavigate} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}
