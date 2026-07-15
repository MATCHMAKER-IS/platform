import "@platform/ui/tokens.css";
import { Toaster, AppSkin, ThemeSwitcher } from "@platform/ui";
import { themeRegistry } from "../lib/theme-registry.js";

export const metadata = { title: "基盤ショーケース" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body style={{ fontFamily: "var(--font-family, var(--font-sans))", color: "var(--color-fg)", background: "var(--color-bg)", margin: 0 }}>
        <AppSkin registry={themeRegistry}>
          <div style={{ display: "flex", justifyContent: "flex-end", padding: "8px 16px", borderBottom: "1px solid var(--color-border)" }}>
            <ThemeSwitcher />
          </div>
          {children}
          <Toaster />
        </AppSkin>
      </body>
    </html>
  );
}
