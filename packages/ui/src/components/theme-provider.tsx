"use client";
/**
 * テーマプロバイダ。選好(light/dark/system)を保持し、OS 設定の変更を監視、localStorage に永続化、
 * <html> にクラス/属性を適用する。子孫は useTheme() で現在のテーマと切替関数を取得できる。
 * ちらつき防止には themeInitScript() を <head> に併用する。
 * @packageDocumentation
 */
import * as React from "react";
import {
  type ThemePreference, type ResolvedTheme,
  resolveTheme, applyTheme, toggleTheme, THEME_STORAGE_KEY,
} from "../lib/theme";

/** useTheme が返す値。 */
export interface ThemeContextValue {
  /** 選好(light/dark/system)。 */
  theme: ThemePreference;
  /** 実際に適用されている見た目(light/dark)。 */
  resolved: ResolvedTheme;
  /** 選好を設定する(永続化される)。 */
  setTheme: (theme: ThemePreference) => void;
  /** 明暗を反転する。 */
  toggle: () => void;
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

/** {@link ThemeProvider} の props。 */
export interface ThemeProviderProps {
  children: React.ReactNode;
  /** 初期選好(localStorage に値が無い場合。既定 "system")。 */
  defaultTheme?: ThemePreference;
  /** localStorage のキー(既定 "theme")。 */
  storageKey?: string;
}

function systemPrefersDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** テーマの状態管理・永続化・適用を提供するプロバイダ。 */
export function ThemeProvider({ children, defaultTheme = "system", storageKey = THEME_STORAGE_KEY }: ThemeProviderProps) {
  const [theme, setThemeState] = React.useState<ThemePreference>(defaultTheme);
  const [systemDark, setSystemDark] = React.useState(false);

  // 初期化: localStorage から選好を読む
  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey) as ThemePreference | null;
      if (stored === "light" || stored === "dark" || stored === "system") setThemeState(stored);
    } catch {
      /* ignore */
    }
    setSystemDark(systemPrefersDark());
  }, [storageKey]);

  // OS 設定の変更を監視
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystemDark(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const resolved = resolveTheme(theme, systemDark);

  // 解決結果を <html> に適用
  React.useEffect(() => {
    if (typeof document !== "undefined") applyTheme(resolved, document.documentElement);
  }, [resolved]);

  const setTheme = React.useCallback((next: ThemePreference) => {
    setThemeState(next);
    try {
      localStorage.setItem(storageKey, next);
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  const toggle = React.useCallback(() => {
    setTheme(toggleTheme(resolved) as ThemePreference);
  }, [resolved, setTheme]);

  const value: ThemeContextValue = { theme, resolved, setTheme, toggle };
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** 現在のテーマと切替関数を取得する。ThemeProvider の内側で使う。 */
export function useTheme(): ThemeContextValue {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme は ThemeProvider の内側で使ってください");
  return ctx;
}
