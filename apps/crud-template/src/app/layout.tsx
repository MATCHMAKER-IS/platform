import * as React from "react";
import { AppSkin, ThemeSwitcher } from "@platform/ui";
import { themeRegistry } from "../lib/theme-registry.js";

export const metadata = { title: "CRUD テンプレート" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body style={{ fontFamily: "var(--font-family, sans-serif)", margin: 0, background: "var(--color-bg, #fff)", color: "var(--color-fg, #111)" }}>
        <AppSkin registry={themeRegistry}>
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
