"use client";
/**
 * ナビ用ドロップダウンメニュー（データ駆動）。ラベルにホバー/クリックで子リンクを開く。
 * @platform/site の MenuItem をそのまま渡せる。
 * @packageDocumentation
 */
import * as React from "react";
import { cn } from "../lib/cn.js";

/** メニュー項目。 */
export interface NavItem {
  label: string;
  href?: string;
  children?: NavItem[];
  external?: boolean;
}

/** {@link NavDropdown} の props。 */
export interface NavDropdownProps {
  items: NavItem[];
  className?: string;
}

function TopItem({ item }: { item: NavItem }) {
  const [open, setOpen] = React.useState(false);
  const hasChildren = !!item.children && item.children.length > 0;
  if (!hasChildren) {
    return (
      <a href={item.href ?? "#"} className="px-3 py-2 text-sm hover:text-[var(--color-primary)]" {...(item.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
        {item.label}
      </a>
    );
  }
  return (
    <div className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button className="flex items-center gap-1 px-3 py-2 text-sm hover:text-[var(--color-primary)]" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {item.label}
        <span className="text-[10px]">▾</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-20 min-w-40 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg,#fff)] py-1 shadow-lg">
          {item.children!.map((child) => (
            <a
              key={child.label}
              href={child.href ?? "#"}
              className="block px-3 py-2 text-sm hover:bg-[var(--color-muted-bg,#f5f5f5)]"
              {...(child.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            >
              {child.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

/** ナビゲーション用ドロップダウン。 */
export function NavDropdown({ items, className }: NavDropdownProps) {
  return (
    <nav className={cn("flex items-center gap-1", className)}>
      {items.map((item) => (
        <TopItem key={item.label} item={item} />
      ))}
    </nav>
  );
}
