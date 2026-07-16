"use client";
/**
 * コンテキストメニュー。子要素を右クリックすると、カーソル位置にメニューを表示する。
 * 外側クリック/Esc/項目選択で閉じる。
 * @packageDocumentation
 */
import * as React from "react";
import { cn } from "../lib/cn";

/** メニュー項目。 */
export interface ContextMenuItem {
  label: string;
  onSelect?: () => void;
  icon?: React.ReactNode;
  /** 上に区切り線。 */
  separated?: boolean;
  danger?: boolean;
  disabled?: boolean;
}

/** {@link ContextMenu} の props。 */
export interface ContextMenuProps {
  items: ContextMenuItem[];
  children: React.ReactNode;
  className?: string;
}

/** 右クリックでメニューを出すラッパー。 */
export function ContextMenu({ items, children, className }: ContextMenuProps) {
  const [pos, setPos] = React.useState<{ x: number; y: number } | null>(null);

  React.useEffect(() => {
    if (!pos) return;
    function close() { setPos(null); }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setPos(null); }
    document.addEventListener("click", close);
    document.addEventListener("scroll", close, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("scroll", close, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [pos]);

  function onContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    setPos({ x: e.clientX, y: e.clientY });
  }

  return (
    <>
      <div onContextMenu={onContextMenu} className={className}>{children}</div>
      {pos && (
        <div
          role="menu"
          className="fixed z-50 min-w-44 overflow-hidden rounded-[var(--radius)] border border-[var(--color-border)] bg-white py-1 shadow-lg"
          style={{ top: pos.y, left: pos.x }}
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
        >
          {items.map((item, i) => (
            <button
              key={i}
              role="menuitem"
              type="button"
              disabled={item.disabled}
              onClick={() => { setPos(null); item.onSelect?.(); }}
              className={cn(
                "flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm transition-colors disabled:opacity-40",
                item.danger ? "text-[var(--color-danger)] hover:bg-red-50" : "text-[var(--color-fg)] hover:bg-slate-50",
                item.separated && "mt-1 border-t border-[var(--color-border)] pt-2",
              )}
            >
              {item.icon != null && <span className="shrink-0">{item.icon}</span>}
              <span className="flex-1">{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

/**
 * 右クリック(コンテキストメニュー)を無効化するフック。
 * ref を渡せばその要素内のみ、省略すれば document 全体。
 * 注意: 既定のブラウザ操作を奪うため、アクセシビリティ/利便性の観点から用途を限定して使うこと
 * (例: 画像の保護、キオスク端末)。多用は避ける。
 */
export function useDisableContextMenu(ref?: { current: HTMLElement | null }, enabled = true): void {
  React.useEffect(() => {
    if (!enabled || typeof document === "undefined") return;
    const target: HTMLElement | Document = ref?.current ?? document;
    const handler = (e: Event) => e.preventDefault();
    target.addEventListener("contextmenu", handler);
    return () => target.removeEventListener("contextmenu", handler);
  }, [ref, enabled]);
}
