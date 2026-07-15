"use client";
/**
 * 共通 Combobox。検索して選べるドロップダウン(Radix Popover + cmdk)。
 * 選択肢が多い場合の入力に向く。
 * @packageDocumentation
 */
import * as React from "react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { Command } from "cmdk";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "../lib/cn.js";
import { useT } from "./i18n-provider.js";

/** 選択肢。 */
export interface ComboboxOption {
  label: string;
  value: string;
}

/** {@link Combobox} の props。 */
export interface ComboboxProps {
  options: ComboboxOption[];
  /** 選択中の値。 */
  value?: string;
  /** 選択変更時のコールバック。 */
  onChange?: (value: string) => void;
  /** 未選択時の表示。 */
  placeholder?: string;
  /** 検索欄のプレースホルダ。 */
  searchPlaceholder?: string;
  /** 一致なしの表示。 */
  emptyText?: string;
  className?: string;
}

/**
 * 検索付きドロップダウン(コンボボックス)。
 * @example
 * ```tsx
 * <Combobox
 *   options={[{ label: "東京", value: "tokyo" }, { label: "大阪", value: "osaka" }]}
 *   value={pref}
 *   onChange={setPref}
 *   placeholder="都道府県を選択"
 * />
 * ```
 */
export function Combobox({
  const t = useT();
  options,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  emptyText,
  className,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]",
            !selected && "text-[var(--color-muted)]",
            className,
          )}
        >
          {selected ? selected.label : (placeholder ?? t("select.placeholder"))}
          <ChevronsUpDown className="h-4 w-4 opacity-50" />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={4}
          className="z-50 w-[var(--radix-popover-trigger-width)] rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-1 shadow-md"
        >
          <Command>
            <Command.Input
              placeholder={searchPlaceholder ?? t("select.searchPlaceholder")}
              className="h-9 w-full border-0 border-b border-[var(--color-border)] bg-transparent px-2 text-sm outline-none placeholder:text-[var(--color-muted)]"
            />
            <Command.List className="max-h-60 overflow-auto py-1">
              <Command.Empty className="px-2 py-3 text-center text-sm text-[var(--color-muted)]">
                {emptyText || t("select.notFound")}
              </Command.Empty>
              {options.map((o) => (
                <Command.Item
                  key={o.value}
                  value={o.label}
                  onSelect={() => {
                    onChange?.(o.value);
                    setOpen(false);
                  }}
                  className="flex cursor-pointer items-center gap-2 rounded-[calc(var(--radius)-2px)] px-2 py-1.5 text-sm text-[var(--color-fg)] data-[selected=true]:bg-slate-100"
                >
                  <Check className={cn("h-4 w-4", value === o.value ? "opacity-100" : "opacity-0")} />
                  {o.label}
                </Command.Item>
              ))}
            </Command.List>
          </Command>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
