"use client";
/**
 * ユーザーメニュー。アバター + 名前をトリガーに、プロフィール/設定/ログアウト等を出す。
 * ヘッダー右端に置く想定。開閉は内部状態、外側クリックで閉じる。
 * @packageDocumentation
 */
import * as React from "react";
import { cn } from "../lib/cn";

/** メニュー項目。 */
export interface UserMenuItem {
  label: string;
  href?: string;
  /** クリック時(href が無い場合の動作。ログアウト等)。 */
  onSelect?: () => void;
  icon?: React.ReactNode;
  /** 区切り線を上に引く。 */
  separated?: boolean;
  /** 危険操作(赤字。ログアウト等)。 */
  danger?: boolean;
}

/** {@link UserMenu} の props。 */
export interface UserMenuProps {
  /** 表示名。 */
  name: string;
  /** 補足(メール・役割など)。 */
  detail?: string;
  /** アバター(未指定なら頭文字)。 */
  avatar?: React.ReactNode;
  items: UserMenuItem[];
  className?: string;
}

/** アバター + ドロップダウンのユーザーメニュー。 */
export function UserMenu({ name, detail, avatar, items, className }: UserMenuProps) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const initial = name.trim().charAt(0).toUpperCase();

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-[var(--radius)] p-1 pr-2 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
      >
        <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-[var(--color-primary)] text-sm font-medium text-[var(--color-primary-fg)]">
          {avatar ?? initial}
        </span>
        <span className="hidden text-sm font-medium text-[var(--color-fg)] sm:block">{name}</span>
        <span className="text-[var(--color-muted)]" aria-hidden="true">▾</span>
      </button>

      {open && (
        <div role="menu" className="absolute right-0 z-40 mt-1 w-56 overflow-hidden rounded-[var(--radius)] border border-[var(--color-border)] bg-white py-1 shadow-lg">
          <div className="border-b border-[var(--color-border)] px-3 py-2">
            <div className="truncate text-sm font-medium text-[var(--color-fg)]">{name}</div>
            {detail != null && <div className="truncate text-xs text-[var(--color-muted)]">{detail}</div>}
          </div>
          {items.map((item, i) => {
            const cls = cn(
              "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors",
              item.danger ? "text-[var(--color-danger)] hover:bg-red-50" : "text-[var(--color-fg)] hover:bg-slate-50",
              item.separated && "mt-1 border-t border-[var(--color-border)] pt-2.5",
            );
            const inner = (
              <>
                {item.icon != null && <span className="shrink-0">{item.icon}</span>}
                <span className="flex-1">{item.label}</span>
              </>
            );
            return item.href ? (
              <a key={i} role="menuitem" href={item.href} className={cls} onClick={() => setOpen(false)}>{inner}</a>
            ) : (
              <button
                key={i}
                role="menuitem"
                type="button"
                className={cls}
                onClick={() => { setOpen(false); item.onSelect?.(); }}
              >
                {inner}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
