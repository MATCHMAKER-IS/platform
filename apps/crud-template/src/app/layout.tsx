// **順序が大事。** tokens.css(色などの変数)→ globals.css(Tailwind 本体)。
// どちらが欠けても見た目が崩れる(変数が無ければ色が出ず、Tailwind が
// 無ければレイアウトが効かない)
import "@platform/ui/tokens.css";
import "./globals.css";
import * as React from "react";
import { AppSkin, ThemeSwitcher, EnvBanner } from "@platform/ui";

export const metadata = { title: "CRUD テンプレート" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body style={{ fontFamily: "var(--font-family, sans-serif)", margin: 0, background: "var(--color-bg, #fff)", color: "var(--color-fg, #111)" }}>
        {/* **いまどの環境か**を最初に出す。
            検証環境と本番は見た目が同じで、**取り違えると実害が出る**——
            本物の取引先にメールが飛ぶ、本番のデータを消す、など。
            **本番では何も出ません**(常時表示は読まれなくなるため) */}
        <EnvBanner />
        <AppSkin>
          <header style={{ borderBottom: "1px solid var(--color-border, #e5e5e5)", padding: "12px 24px", fontWeight: 600, background: "var(--color-surface, #fff)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>マスタ管理テンプレート</span>
            <ThemeSwitcher />
          </header>
          {children}
        </AppSkin>
      </body>
    </html>
  );
}
