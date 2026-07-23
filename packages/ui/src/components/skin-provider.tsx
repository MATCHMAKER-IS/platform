"use client";
/**
 * スキン(デザインテーマ)プロバイダ。@platform/theme のレジストリと連携し、選択スキンを
 * localStorage に永続化して <html> に data-skin / CSS 変数を適用する。
 *
 * 明暗(既存 ThemeProvider の light/dark)とは直交する。SkinProvider は明暗モードを
 * prop で受け取り、スキン × モードの両方を適用する。ThemeProvider の内側に置く想定。
 * @packageDocumentation
 */
import * as React from "react";
import { applySkin, type Theme, type ThemeMode, type ThemeRegistry } from "@platform/theme";

export interface SkinContextValue {
  /** 現在のスキン id。 */
  skinId: string;
  /** 現在のスキン(解決済み)。 */
  skin: Theme;
  /** 選べるスキンの一覧。 */
  available: { id: string; name: string; description?: string }[];
  /** スキンを切り替える(永続化される)。 */
  setSkin: (id: string) => void;
  /** 現在の明暗モード(light / dark)。 */
  mode: ThemeMode;
  /** 明暗モードを切り替える。 */
  setMode: (m: ThemeMode) => void;
}

const SkinContext = React.createContext<SkinContextValue | null>(null);

export interface SkinProviderProps {
  children: React.ReactNode;
  /** テーマレジストリ(@platform/theme の createThemeRegistry で作る)。 */
  registry: ThemeRegistry;
  /** 現在の明暗モード(既存 ThemeProvider の resolved を渡す)。既定 "light"。 */
  mode?: ThemeMode;
  /** 明暗モードの切り替え関数(AppSkin から渡す)。省略時は切替不可。 */
  setMode?: (m: ThemeMode) => void;
  /** 初期スキン id(localStorage に無い場合。既定はレジストリの既定)。 */
  defaultSkinId?: string;
  /** localStorage のキー(既定 "skin")。 */
  storageKey?: string;
}

/**
 * 配色の受け渡し(内部用)。
 *
 * 通常は `AppSkin` を使う。こちらは配色を自前で管理したい場合の下層。
 */
export const SKIN_STORAGE_KEY = "skin";

export function SkinProvider({ children, registry, mode = "light", setMode, defaultSkinId, storageKey = SKIN_STORAGE_KEY }: SkinProviderProps) {
  const initial = defaultSkinId ?? registry.getDefaultId() ?? registry.ids()[0] ?? "default";
  const [skinId, setSkinId] = React.useState<string>(initial);

  // 起動時に保存済みスキンを読む
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(storageKey);
    if (stored && registry.has(stored)) setSkinId(stored);
  }, [registry, storageKey]);

  const skin = registry.resolve(skinId);

  // スキン or モードが変わったら <html> に適用
  React.useEffect(() => {
    if (typeof document !== "undefined") applySkin(skin, mode, document.documentElement);
  }, [skin, mode]);

  const setSkin = React.useCallback((id: string) => {
    if (!registry.has(id)) return;
    setSkinId(id);
    if (typeof window !== "undefined") window.localStorage.setItem(storageKey, id);
  }, [registry, storageKey]);

  const value: SkinContextValue = {
    skinId,
    skin,
    available: registry.list().map((t) => ({ id: t.id, name: t.name, ...(t.description ? { description: t.description } : {}) })),
    setSkin,
    mode,
    setMode: setMode ?? (() => {}),
  };

  return <SkinContext.Provider value={value}>{children}</SkinContext.Provider>;
}

/** 現在のスキンと切替関数を取得する。SkinProvider の外で呼ぶと例外。 */
export function useSkin(): SkinContextValue {
  const ctx = React.useContext(SkinContext);
  if (!ctx) throw new Error("useSkin は SkinProvider の内側で使ってください");
  return ctx;
}
