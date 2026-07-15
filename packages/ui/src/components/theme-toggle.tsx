"use client";
/**
 * テーマ切替ボタン。ライト/ダーク(+システム)を切り替える。
 * 選好はアプリ側で保持(controlled)。クリックで次の選好を通知する。
 * @packageDocumentation
 */
import * as React from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { cn } from "../lib/cn.js";
import { type ThemePreference, type ResolvedTheme, nextThemePreference, toggleTheme, THEME_LABELS } from "../lib/theme.js";

/** {@link ThemeToggle} の props。 */
export interface ThemeToggleProps {
  /** 現在の選好(controlled)。 */
  theme: ThemePreference;
  /** 選好が変わったとき。 */
  onThemeChange: (theme: ThemePreference) => void;
  /**
   * 切り替え方式。"cycle" は light→dark→system の 3 状態、"toggle" は明暗 2 状態。既定 "cycle"。
   */
  mode?: "cycle" | "toggle";
  /** system 表示時のアイコン判定に使う、解決済みテーマ。 */
  resolved?: ResolvedTheme;
  className?: string;
}

/** ライト/ダークを切り替えるアイコンボタン。 */
export const ThemeToggle = React.forwardRef<HTMLButtonElement, ThemeToggleProps>(
  ({ theme, onThemeChange, mode = "cycle", resolved, className }, ref) => {
    const handleClick = () => {
      if (mode === "toggle") {
        const current: ResolvedTheme = resolved ?? (theme === "dark" ? "dark" : "light");
        onThemeChange(toggleTheme(current));
      } else {
        onThemeChange(nextThemePreference(theme));
      }
    };
    const Icon = theme === "system" ? Monitor : theme === "dark" ? Moon : Sun;
    const label = `テーマ: ${THEME_LABELS[theme]}`;
    return (
      <button
        ref={ref}
        type="button"
        onClick={handleClick}
        aria-label={label}
        title={label}
        className={cn(
          "inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius)] text-[var(--color-fg)] transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]",
          className,
        )}
      >
        <Icon size={18} aria-hidden="true" />
      </button>
    );
  },
);
ThemeToggle.displayName = "ThemeToggle";
