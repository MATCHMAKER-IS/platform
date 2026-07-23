// public-api: Service Worker 本体。ブラウザが認証なしで取得するため
/**
 * Service Worker。オフラインでも最低限の画面が出るようにする。
 *
 * 倉庫や外回りでは電波が不安定な場所で開かれる。
 * 「圏外になった瞬間に真っ白」を避けることが、現場での実用性を大きく変える。
 *
 * **version を変えると古いキャッシュが捨てられる。** 画面を更新したのに
 * 古いものが出る場合は、ここを更新すること。
 */
import { buildServiceWorker } from "@platform/mobile";

// public-api の宣言があるため認可は通さない(ブラウザが直接取りに来る)
export async function GET(): Promise<Response> {
  const body = buildServiceWorker({
    // 更新のたびに変える。日付にしておくと、いつの版か分かる
    version: "2026-07-23",
    precache: ["/", "/offline"],
    offlineFallback: "/offline",
    rules: [
      // 静的ファイルは変わらないのでキャッシュ優先
      { pattern: "/_next/static/", strategy: "cache-first" },
      { pattern: "/icon-", strategy: "cache-first" },
    ],
  });
  return new Response(body, {
    headers: {
      "Content-Type": "text/javascript; charset=utf-8",
      // Service Worker 自体はキャッシュさせない(更新が届かなくなる)
      "Cache-Control": "no-cache",
    },
  });
}
