import "@platform/ui/tokens.css";
import "./globals.css";
import { Toaster, AppSkin, ThemeSwitcher, BackToTop } from "@platform/ui";
import { CollapsibleSidebar } from "../components/collapsible-sidebar";
import { DemoMeta } from "../components/demo-meta";
import { DemoIntro } from "../components/demo-intro";
import { NextDemos } from "../components/next-demos";
import { LiveClock } from "../components/live-clock";
import { ModeToggle } from "../components/mode-toggle";
import { CommandPalette } from "../components/command-palette";
import { DebugPanel } from "../components/debug-panel";

export const metadata = {
  title: "基盤デモ",
  description: "社内基盤(@platform/*)の使い方と、業務アプリの画面を1つにまとめたデモサイト",
};

export const viewport = { width: "device-width", initialScale: 1 };

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
        <AppSkin>
          <div style={{ display: "flex", minHeight: "100vh" }}>
            {/* 左: 区分ごとのナビ(開閉できる) */}
            <CollapsibleSidebar />

            {/* 右: 本文 */}
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  padding: "8px 16px 8px 48px",
                  borderBottom: "1px solid var(--color-border)",
                  position: "sticky",
                  top: 0,
                  background: "var(--color-bg)",
                  zIndex: 10,
                }}
              >
                {/* ホームでは DemoMeta が何も描かないため、space-between だけだと
                    右側の道具が左に寄ってしまう。空でも場所を取らせて右寄せを保つ */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <DemoMeta />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
                  <CommandPalette />
                  <LiveClock compact />
                  <ModeToggle />
                  <ThemeSwitcher />
                </div>
              </div>
              <main style={{ flex: 1 }}>
                <DemoIntro />
                {children}
                {/* 関連するデモへの導線。63 デモあっても、示さないと 1 つ見て終わる */}
                <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 16px 32px" }}>
                  <NextDemos />
                </div>
              </main>
            </div>
          </div>
          <Toaster />
          <BackToTop />
          <DebugPanel />
        </AppSkin>
      </body>
    </html>
  );
}
