import * as React from "react";
import { CopyrightNotice, AppSkin } from "@platform/ui";
import { siteConfig, content } from "../server/content";
import { SiteHeader } from "./site-header";

export const metadata = { title: siteConfig.siteName };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nav = await content.menu();
  return (
    <html lang="ja">
      <body>
        <AppSkin>
          <SiteHeader siteName={siteConfig.siteName} nav={nav} />
          {children}
          <footer className="mt-12 border-t border-neutral-200 py-6 text-center">
            <CopyrightNotice holder={siteConfig.copyrightHolder} startYear={siteConfig.copyrightStartYear} />
          </footer>
        </AppSkin>
      </body>
    </html>
  );
}
