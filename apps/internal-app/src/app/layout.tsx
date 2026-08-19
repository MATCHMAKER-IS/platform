// **順序が大事。** tokens.css(色などの変数)→ globals.css(Tailwind 本体)。
// どちらが欠けても見た目が崩れる(変数が無ければ色が出ず、Tailwind が
// 無ければレイアウトが効かない)
import "@platform/ui/tokens.css";
import { WebVitalsReporter } from "./web-vitals-reporter";
import "./globals.css";
/** ルートレイアウト。 */
import { IdleLogout } from "../components/IdleLogout";
import { MailboxIndicator } from "../components/MailboxIndicator";
import { AppNav } from "../components/AppNav";
import { AfterLogin } from "../components/AfterLogin";
import { ChatbotWidget } from "../components/ChatbotWidget";
import { DebugBar } from "../components/DebugBar";
import { AppSkin, EnvBanner } from "@platform/ui";
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
        {/* **いまどの環境か**を最初に出す。
            検証環境と本番は見た目が同じで、**取り違えると実害が出る**——
            本物の取引先にメールが飛ぶ、本番のデータを消す、など。
            **本番では何も出ません**(常時表示は読まれなくなるため) */}
        <EnvBanner />
        <AppSkin themes={[...builtInThemes, ...customThemes]} defaultSkinId={theme.skinId} defaultMode={theme.mode}>
          <ServiceWorkerRegister />
          {/* **サイドナビ + 本文の横並び。**
              ナビは h-screen で固定し、本文だけが縦にスクロールする
              (ナビが一緒に流れると、長い画面で行き先を見失う)。

              ログイン画面ではナビも通知もチャットも出さない。
              **まだ誰でもない状態でメニューを並べても意味がない**
              (押しても弾かれるだけ)。 */}
          {/* **ナビと本文を別々にスクロールさせる。**
              外側を画面の高さに固定してはみ出しを止め、
              それぞれの中で縦に流す。こうしないと本文がページ全体を
              伸ばし、**ナビの上で回してもページが動く**(2026-08 の指摘)。 */}
          <div className="flex h-screen overflow-hidden">
            <AfterLogin><AppNav /></AfterLogin>
            <main className="min-w-0 flex-1 overflow-y-auto overflow-x-auto">{children}</main>
          </div>
          <AfterLogin>
            <MailboxIndicator />
            <ChatbotWidget />
            <IdleLogout timeoutMinutes={idleMinutes} />
          </AfterLogin>
          {/* 開発時のみ表示(本番は API が 404 を返すため何も出ない) */}
          <AfterLogin><DebugBar /></AfterLogin>
        </AppSkin>
              {/* 画面の速度を測る（1 割だけ送信。表示されるものはありません）。
            **ここに 1 回だけ**置くこと——画面ごとに置くと二重に測ります。 */}
        <WebVitalsReporter />
      </body>
    </html>
  );
}
