"use client";
/**
 * ページビュー計測ビーコン。マウント時に現在パスのページビューを /api/analytics へ送る。
 * レイアウトに 1 つ置けば全ページで計測される。フレームワークのルーティングに合わせて path を渡す。
 * @packageDocumentation
 */
import * as React from "react";
import { createBeacon, ensureSessionId } from "@platform/analytics";

export interface BeaconClientProps {
  /** 計測するパス（既定はブラウザの location.pathname）。 */
  path?: string;
  /** ログインユーザーID（任意）。 */
  userId?: string;
  /** 送信先（既定 /api/analytics）。 */
  endpoint?: string;
}

/** セッションIDを sessionStorage で保持（無ければ生成）。SSR では生成のみ。 */
function getSessionId(): string {
  try {
    const store = (globalThis as unknown as { sessionStorage?: Storage }).sessionStorage;
    const key = "analytics_sid";
    const current = store?.getItem(key);
    const sid = ensureSessionId(current, () => Math.random().toString(36).slice(2) + Date.now().toString(36));
    store?.setItem(key, sid);
    return sid;
  } catch {
    return ensureSessionId(null, () => Math.random().toString(36).slice(2));
  }
}

export function BeaconClient({ path, userId, endpoint }: BeaconClientProps) {
  React.useEffect(() => {
    const nav = (globalThis as unknown as { navigator?: { sendBeacon?: (u: string, b: BodyInit) => boolean }; location?: { pathname: string }; document?: { referrer: string } });
    const beacon = createBeacon({
      sessionId: getSessionId(),
      ...(endpoint ? { endpoint } : {}),
      ...(nav.navigator?.sendBeacon ? { sendBeacon: (u: string, b: string) => nav.navigator!.sendBeacon!(u, b) } : {}),
      fetch: (u, init) => fetch(u, init as RequestInit),
    });
    const p = path ?? nav.location?.pathname ?? "/";
    const referrer = nav.document?.referrer || undefined;
    beacon.pageview(p, { ...(userId ? { userId } : {}), ...(referrer ? { referrer } : {}) });
  }, [path, userId, endpoint]);

  return null;
}
