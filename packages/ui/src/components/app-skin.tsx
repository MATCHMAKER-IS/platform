"use client";
/**
 * アプリ全体にスキンを適用する汎用ラッパー。各アプリの layout で使う。
 * 全スキン × 2 モードの CSS を一度だけ <style> に注入し、SkinProvider で子孫に文脈を渡す。
 * prefers-color-scheme（system）に追従する明暗切り替え込み。
 *
 * **props はすべてプレーンデータにしてある。** Server Component(= 各アプリの layout.tsx)から
 * そのまま使えるようにするため。ThemeRegistry のように関数を持つオブジェクトを props で
 * 受け取る設計にすると、RSC のシリアライズを通れず `next build` のプリレンダで落ちる:
 *
 *   Error: Functions cannot be passed directly to Client Components
 *
 * dev では動き、build で初めて落ちる。レジストリは **この中(client 境界の内側)で組み立てる**。
 * アプリ側は `<AppSkin>...</AppSkin>` と書くだけでよい。
 * @packageDocumentation
 */
import * as React from "react";
import { buildThemeStylesheet, createThemeRegistry, builtInThemes, type Theme } from "@platform/theme";
import { SkinProvider } from "./skin-provider";

export interface AppSkinProps {
  children: React.ReactNode;
  /**
   * 適用するテーマ。省略時は組み込みスキン(builtInThemes)。
   * 組織のカスタムテーマを足すなら `themes={[...builtInThemes, ...customThemes]}`。
   * Theme はプレーンデータなので、DB から読んだものを **サーバから直接渡してよい**。
   * 不正なテーマは黙って無視する(他を活かす)。
   */
  themes?: Theme[];
  /** 組織デフォルトのスキン id(サーバから渡す場合)。 */
  defaultSkinId?: string;
  /** 明暗の初期値。"system" は端末設定に追従。既定 "system"。 */
  defaultMode?: "light" | "dark" | "system";
}

/**
 * アプリ全体の見た目(配色・明暗)を包む。
 *
 * **レイアウトの一番外側に 1 つだけ置く。** 配色の切り替えと、
 * 明るい/暗いの追従をここが受け持つ。
 *
 * | props | 使いどころ |
 * |---|---|
 * | `themes` | 使える配色の一覧。組み込みと自作を合わせて渡す |
 * | `defaultSkinId` | 組織の既定の配色(サーバの設定から渡す) |
 * | `defaultMode` | 明暗の初期値。**既定の `"system"` は端末設定に追従** |
 *
 * 利用者が選んだ配色は保存され、次に開いたときも残る。
 * サーバ側で配色を決めたい場合だけ `defaultSkinId` を渡す。
 *
 * @example
 * ```tsx
 * // app/layout.tsx
 * <AppSkin themes={[...builtInThemes, ...customThemes]} defaultSkinId={setting.skinId}>
 *   <AppNav />
 *   {children}
 * </AppSkin>
 * ```
 */
export function AppSkin({ children, themes, defaultSkinId, defaultMode = "system" }: AppSkinProps) {
  // レジストリはここで作る。server から渡させない(渡せない)。
  const registry = React.useMemo(() => {
    const r = createThemeRegistry();
    for (const t of themes ?? builtInThemes) {
      try { r.register(t); } catch { /* 不正なテーマは無視して他を活かす */ }
    }
    // 既定は先頭(createThemeRegistry に themes を渡したときと同じ挙動に揃える)
    const first = r.ids()[0];
    if (first !== undefined) r.setDefault(first);
    return r;
  }, [themes]);

  const css = React.useMemo(() => buildThemeStylesheet(registry.list()), [registry]);
  const [mode, setMode] = React.useState<"light" | "dark">(defaultMode === "dark" ? "dark" : "light");
  const manualRef = React.useRef(false);
  const handleSetMode = React.useCallback((m: "light" | "dark") => {
    manualRef.current = true; // 手動で切り替えたら、以降はシステム追従を止める
    setMode(m);
  }, []);

  React.useEffect(() => {
    if (defaultMode !== "system" || typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    if (!manualRef.current) setMode(mq.matches ? "dark" : "light");
    const onChange = (e: MediaQueryListEvent) => { if (!manualRef.current) setMode(e.matches ? "dark" : "light"); };
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
      <SkinProvider registry={registry} mode={mode} setMode={handleSetMode} {...(defaultSkinId ? { defaultSkinId } : {})}>
        {children}
      </SkinProvider>
    </>
  );
}
