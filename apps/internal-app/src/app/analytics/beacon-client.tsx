"use client";
/**
 * 社内アプリのページビュー計測。
 *
 * レイアウトに 1 つ置けば全ページで計測される。
 * フレームワークのルーティングに合わせて path を渡す。
 *
 * **中身は `@platform/ui` の `usePageview` に移した**(2026-08)。
 * `public-site` にも同じ形のラッパーがあり、セッション ID の採番と保存を
 * 別々に書いていた。
 */
import { usePageview } from "@platform/ui";

/** {@link BeaconClient} の設定。 */
export interface BeaconClientProps {
  /** 計測するパス（既定はブラウザの location.pathname）。 */
  path?: string;
  /** ログイン中の利用者。**社内アプリなので送ってよい**(公開サイトでは送らない)。 */
  userId?: string;
}

/**
 * ページビューを送る(表示は無い)。
 */
export function BeaconClient({ path, userId }: BeaconClientProps) {
  // **`location.pathname` を既定にする。** サーバ側では空文字になるが、
  // このコンポーネントは `"use client"` なので描画時には値がある
  const resolved = path ?? (typeof location !== "undefined" ? location.pathname : "/");
  usePageview({
    path: resolved,
    namespace: "internal-app",
    ...(userId !== undefined ? { userId } : {}),
  });
  return null;
}
