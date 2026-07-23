/** ルートレイアウト。 */
import { IdleLogout } from "../components/IdleLogout";
import { MailboxIndicator } from "../components/MailboxIndicator";
import { AppNav } from "../components/AppNav";
import { ChatbotWidget } from "../components/ChatbotWidget";
import { DebugBar } from "../components/DebugBar";
import { AppSkin } from "@platform/ui";
import { builtInThemes } from "@platform/theme";
import { getThemeSetting, getCustomThemes } from "../server/theme-setting";
import { featureEnv } from "../server/env";
import { ServiceWorkerRegister } from "../components/ServiceWorkerRegister";

// 社内ツールは検索エンジンにインデックスさせない(公開サイトのみ SEO を適用する方針)
export const metadata = {
  title: "社内アプリ",
  // ホーム画面に追加できるようにする(/manifest.json が返す)
  manifest: "/manifest.json",
  robots: { index: false, follow: false, nocache: true },
};

/** スマートフォンで正しい倍率で表示し、テーマ色を端末に伝える。 */
export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1e40af",
};

/** 無操作ログアウトの分。環境変数 IDLE_TIMEOUT_MINUTES(既定 0 = 無効)。 */
const idleMinutes = featureEnv.IDLE_TIMEOUT_MINUTES;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [theme, customThemes] = await Promise.all([getThemeSetting(), getCustomThemes()]);
  return (
    <html lang="ja">
      <body>
        <AppSkin themes={[...builtInThemes, ...customThemes]} defaultSkinId={theme.skinId} defaultMode={theme.mode}>
          <ServiceWorkerRegister />
          <AppNav />
          {children}
          <MailboxIndicator />
          <ChatbotWidget />
          <IdleLogout timeoutMinutes={idleMinutes} />
          {/* 開発時のみ表示(本番は API が 404 を返すため何も出ない) */}
          <DebugBar />
        </AppSkin>
      </body>
    </html>
  );
}
