import "@platform/ui/tokens.css";
import { Toaster, AppSkin, ThemeSwitcher } from "@platform/ui";
import { themeRegistry } from "../lib/theme-registry.js";
import { DemoSidebar } from "../components/demo-sidebar.js";

export const metadata = {
  title: "基盤デモ",
  description: "社内基盤(@platform/*)の使い方と、業務アプリの画面を1つにまとめたデモサイト",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body
        style={{
          fontFamily: "var(--font-family, var(--font-sans))",
          color: "var(--color-fg)",
          background: "var(--color-bg)",
          margin: 0,
        }}
      >
        <AppSkin registry={themeRegistry}>
          <div style={{ display: "flex", minHeight: "100vh" }}>
            {/* 左: 区分ごとのナビ(基盤デモ / アプリデモ / 使用例) */}
            <aside
              style={{
                width: 240,
                flexShrink: 0,
                borderRight: "1px solid var(--color-border)",
                background: "var(--color-surface)",
                overflowY: "auto",
                maxHeight: "100vh",
                position: "sticky",
                top: 0,
              }}
            >
              <DemoSidebar />
            </aside>

            {/* 右: 本文 */}
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  padding: "8px 16px",
                  borderBottom: "1px solid var(--color-border)",
                  position: "sticky",
                  top: 0,
                  background: "var(--color-bg)",
                  zIndex: 10,
                }}
              >
                <ThemeSwitcher />
              </div>
              <main style={{ flex: 1 }}>{children}</main>
            </div>
          </div>
          <Toaster />
        </AppSkin>
      </body>
    </html>
  );
}
