// public-api: PWA の manifest。ブラウザが認証なしで取得するため
/**
 * Web App Manifest。
 *
 * これがあると、Android / iOS のホーム画面にアイコンを置いて
 * **ブラウザの URL バー無しで**起動できる。
 *
 * 手で JSON を置かず基盤で組み立てるのは、必須項目やアイコンの抜けを
 * `checkInstallable()` で検知できるようにするため
 * (ブラウザは「インストールできない」としか言わない)。
 */
import { buildWebManifest } from "@platform/mobile";
import { withApiObservability } from "../../server/instrument";

async function handleGET(): Promise<Response> {
  const manifest = buildWebManifest({
    name: "社内システム",
    shortName: "社内",
    description: "経費・勤怠・請求・在庫などの社内業務",
    themeColor: "#1e40af",
    backgroundColor: "#ffffff",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
    ],
    // よく使う画面はホーム画面のアイコン長押しから直接開けるようにする
    shortcuts: [
      { name: "経費申請", url: "/expenses", description: "経費を申請する" },
      { name: "勤怠", url: "/attendance", description: "打刻・月次集計" },
    ],
  });
  return Response.json(manifest, {
    // manifest はまれにしか変わらない。1 時間キャッシュしてよい
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}

export const GET = withApiObservability("/manifest.json", handleGET);
