"use client";
/**
 * アプリ全体にスキンを適用する汎用ラッパー。各アプリの layout で使う。
 * 全スキン × 2 モードの CSS を一度だけ <style> に注入し、SkinProvider で子孫に文脈を渡す。
 * prefers-color-scheme（system）に追従する明暗切り替え込み。
 *
 * これまで各アプリが個別に持っていた AppThemeProvider を基盤へ引き上げたもの。
 * アプリ側は `<AppSkin registry={themeRegistry}>...</AppSkin>` と書くだけでよい。
 * @packageDocumentation
 */
import * as React from "react";
import { buildThemeStylesheet, type ThemeRegistry, type Theme } from "@platform/theme";
import { SkinProvider } from "./skin-provider.js";

export interface AppSkinProps {
  children: React.ReactNode;
  /** テーマレジストリ(createThemeRegistry で作る)。 */
  registry: ThemeRegistry;
  /**
   * レジストリに追加するテーマ(組織のカスタムテーマなど)。
   * サーバで DB から読んだものを渡す想定。不正なテーマは黙って無視する。
   */
  extraThemes?: Theme[];
  /** 組織デフォルトのスキン id(サーバから渡す場合)。 */
  defaultSkinId?: string;
  /** 明暗の初期値。"system" は端末設定に追従。既定 "system"。 */
  defaultMode?: "light" | "dark" | "system";
}

export function AppSkin({ children, registry, extraThemes, defaultSkinId, defaultMode = "system" }: AppSkinProps) {
  // 追加テーマをレジストリへ反映してから CSS を作る(順序が重要)。
  const css = React.useMemo(() => {
    for (const t of extraThemes ?? []) {
      try { registry.register(t); } catch { /* 不正なテーマは無視して他を活かす */ }
    }
    return buildThemeStylesheet(registry.list());
  }, [registry, extraThemes]);
  const [mode, setMode] = React.useState<"light" | "dark">(defaultMode === "dark" ? "dark" : "light");

  React.useEffect(() => {
    if (defaultMode !== "system" || typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setMode(mq.matches ? "dark" : "light");
    const onChange = (e: MediaQueryListEvent) => setMode(e.matches ? "dark" : "light");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [defaultMode]);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      {/* SSR ちらつき防止: React マウント前に、保存済みスキン/明暗を html 要素へ適用する。
          これがないとリロード時に一瞬デフォルトテーマが見える。localStorage と
          prefers-color-scheme を読んで data-skin / data-theme を先に立てる。 */}
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){try{
            var s=localStorage.getItem('skin')||${JSON.stringify(defaultSkinId ?? "")};
            var m=${JSON.stringify(defaultMode)};
            var theme=m==='system'?(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):(m==='dark'?'dark':'light');
            var el=document.documentElement;
            if(s)el.setAttribute('data-skin',s);
            el.setAttribute('data-theme',theme);
          }catch(e){}})();`,
        }}
      />
      <SkinProvider registry={registry} mode={mode} {...(defaultSkinId ? { defaultSkinId } : {})}>
        {children}
      </SkinProvider>
    </>
  );
}
