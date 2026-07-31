/**
 * アプリの骨組み。
 *
 * 配色とテーマは基盤（AppSkin）に任せる。ここに色を書かない。
 */
import * as React from "react";
import { AppSkin, Toaster } from "@platform/ui";
import { builtInThemes } from "@platform/theme";
import "@platform/ui/tokens.css";

export const metadata = {
  title: "口座残高",
  // 社内向けなので検索させない
  robots: { index: false, follow: false },
};

export const viewport = { width: "device-width", initialScale: 1, themeColor: "#1e293b" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <AppSkin themes={builtInThemes} defaultSkinId="navy-sidebar">
          {children}
          <Toaster />
        </AppSkin>
      </body>
    </html>
  );
}
