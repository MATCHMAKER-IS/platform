import * as React from "react";
import { AppSkin } from "@platform/ui";
import { themeRegistry } from "../lib/theme-registry.js";

export const metadata = { title: "Platform Portal", description: "社内基盤のカタログ・ドキュメント・健康診断" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body style={{ fontFamily: "var(--font-family, system-ui, sans-serif)", margin: 0, background: "var(--color-bg, #fafafa)", color: "var(--color-fg, #1a1a1a)" }}>
        <AppSkin registry={themeRegistry}>{children}</AppSkin>
      </body>
    </html>
  );
}
