"use client";
/**
 * 共通 ColorPicker。スウォッチをクリックすると Popover でカラーピッカーを開く。
 * 内部は react-colorful。値は 16 進カラー("#rrggbb")。
 * @packageDocumentation
 */
import * as React from "react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { HexColorPicker } from "react-colorful";
import { cn } from "../lib/cn.js";

/** {@link ColorPicker} の props。 */
export interface ColorPickerProps {
  /** 選択中の色("#rrggbb")。 */
  value?: string;
  /** 変更時のコールバック。 */
  onChange?: (color: string) => void;
  className?: string;
}

/**
 * カラーピッカー。
 * @example
 * ```tsx
 * <ColorPicker value={color} onChange={setColor} />
 * ```
 */
export function ColorPicker({ value = "#0f766e", onChange, className }: ColorPickerProps) {
  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-10 items-center gap-2 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]",
            className,
          )}
        >
          <span className="h-5 w-5 rounded border border-[var(--color-border)]" style={{ backgroundColor: value }} />
          <span className="uppercase">{value}</span>
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          sideOffset={4}
          className="z-50 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-3 shadow-md"
        >
          <HexColorPicker color={value} onChange={(c) => onChange?.(c)} />
          <input
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            className="mt-2 h-8 w-full rounded-[calc(var(--radius)-2px)] border border-[var(--color-border)] px-2 text-sm uppercase"
          />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
