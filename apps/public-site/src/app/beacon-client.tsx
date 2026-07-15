"use client";
/** 公開サイトのページビュー計測ビーコン。 */
import * as React from "react";
import { createBeacon, ensureSessionId } from "@platform/analytics";

function getSessionId(): string {
  try {
    const store = (globalThis as unknown as { sessionStorage?: Storage }).sessionStorage;
    const key = "site_sid";
    const current = store?.getItem(key);
    const sid = ensureSessionId(current, () => Math.random().toString(36).slice(2) + Date.now().toString(36));
    store?.setItem(key, sid);
    return sid;
  } catch {
    return ensureSessionId(null, () => Math.random().toString(36).slice(2));
  }
}

export function BeaconClient({ path }: { path: string }) {
  React.useEffect(() => {
    const nav = globalThis as unknown as { navigator?: { sendBeacon?: (u: string, b: BodyInit) => boolean }; document?: { referrer: string } };
    const beacon = createBeacon({
      sessionId: getSessionId(),
      ...(nav.navigator?.sendBeacon ? { sendBeacon: (u: string, b: string) => nav.navigator!.sendBeacon!(u, b) } : {}),
      fetch: (u, init) => fetch(u, init as RequestInit),
    });
    const referrer = nav.document?.referrer || undefined;
    beacon.pageview(path, { ...(referrer ? { referrer } : {}) });
  }, [path]);
  return null;
}
