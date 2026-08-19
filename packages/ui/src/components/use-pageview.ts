"use client";
/**
 * ページビューの計測。
 *
 * 【なぜ要るか】
 * `internal-app` と `public-site` が**同じ形のラッパーを別々に持っていた**。
 * どちらも `@platform/analytics` の `createBeacon` を呼ぶだけだが、
 * **セッション ID の採番と保存**を毎回書き直しており、
 * 書き直すたびに「タブを閉じたら消す」「保存に失敗しても計測は続ける」が抜ける。
 *
 * @packageDocumentation
 */
import * as React from "react";
import { browserBeaconDeps, createBeacon, ensureSessionId } from "@platform/analytics";
import { createWebStorage } from "@platform/web-storage";

/** {@link usePageview} の設定。 */
export interface PageviewOptions {
  /** 計測するパス(`/about` など)。 */
  path: string;
  /**
   * 保存する名前空間。
   *
   * **アプリごとに分ける。** 同じブラウザで社内アプリと公開サイトを開いたとき、
   * **セッション ID が混ざる**と計測が繋がってしまう。
   */
  namespace: string;
  /** ログイン中の利用者(社内アプリのみ。公開サイトでは渡さない)。 */
  userId?: string;
  /** 参照元(省略すると `document.referrer`)。 */
  referrer?: string;
}

/**
 * ページビューを 1 回だけ送る。
 *
 * **セッション ID はタブを閉じたら消す**(`sessionStorage`)——
 * 訪問者の端末に残す必要が無く、**残すと同意が要る**扱いになりうる。
 *
 * **保存に失敗しても計測は続ける。** プライベートモードや容量超過で
 * `sessionStorage` が使えないことがあるが、**ID が毎回変わるだけ**で
 * ページビューの数は数えられる——計測のために画面を壊さない。
 *
 * **`path` が変わるたびに送る。** SPA の遷移でも数えられるように、
 * 依存配列に `path` を入れている。
 *
 * @param options 計測の設定
 *
 * @example
 * ```tsx
 * // 公開サイト(匿名)
 * usePageview({ path: `/${slug}`, namespace: "public-site" });
 *
 * // 社内アプリ(利用者つき)
 * usePageview({ path: pathname, namespace: "internal-app", userId: user.email });
 * ```
 */
export function usePageview(options: PageviewOptions): void {
  const { path, namespace, userId, referrer } = options;

  React.useEffect(() => {
    // **タブを閉じたら消す。** 訪問者の端末に残す必要が無い
    const sidStore = createWebStorage<string>({ key: "beacon-sid", fallback: "", kind: "session", namespace });
    const current = sidStore.get();
    const sid = ensureSessionId(
      current === "" ? null : current,
      () => Math.random().toString(36).slice(2) + Date.now().toString(36),
    );
    // **保存に失敗しても計測は続ける**(ID が毎回変わるだけ)
    sidStore.set(sid);

    const ref = referrer ?? (typeof document !== "undefined" ? document.referrer : "");
    const beacon = createBeacon({ sessionId: sid, ...browserBeaconDeps() });
    beacon.pageview(path, {
      ...(userId !== undefined && userId !== "" ? { userId } : {}),
      ...(ref !== "" ? { referrer: ref } : {}),
    });
  }, [path, namespace, userId, referrer]);
}
