/**
 * ブラウザ計測ビーコン。ページビュー等を計測エンドポイントへ送る。フレームワーク非依存。
 * navigator.sendBeacon があれば優先し、無ければ fetch(keepalive) にフォールバックする。
 * @packageDocumentation
 */
import { type AnalyticsEventType } from "./event.js";

/** ビーコンで送るペイロード。 */
export interface BeaconPayload {
  type: AnalyticsEventType;
  path: string;
  sessionId: string;
  userId?: string;
  referrer?: string;
  name?: string;
}

/** ビーコンの依存（テスト注入用）。 */
export interface BeaconDeps {
  /** 送信先エンドポイント（既定 "/api/analytics"）。 */
  endpoint?: string;
  /** sendBeacon 実装（無ければ fetch にフォールバック）。 */
  sendBeacon?: (url: string, body: string) => boolean;
  /** fetch 実装。 */
  fetch?: (url: string, init: { method: string; body: string; headers: Record<string, string>; keepalive?: boolean }) => Promise<unknown>;
}

/** ビーコン。 */
export interface Beacon {
  /** イベントを送る。 */
  send(payload: BeaconPayload): void;
  /** ページビューを送る（type=pageview の糖衣）。 */
  pageview(path: string, extra?: { userId?: string; referrer?: string }): void;
}

/** セッションIDを組み立てる（無ければ生成関数で作る）。 */
export function ensureSessionId(current: string | null | undefined, generate: () => string): string {
  return current && current.length > 0 ? current : generate();
}

/** ビーコンを作る。 */
export function createBeacon(config: { sessionId: string } & BeaconDeps): Beacon {
  const endpoint = config.endpoint ?? "/api/analytics";
  const send = (payload: BeaconPayload) => {
    const body = JSON.stringify(payload);
    if (config.sendBeacon) {
      const okSent = config.sendBeacon(endpoint, body);
      if (okSent) return;
    }
    if (config.fetch) {
      void config.fetch(endpoint, { method: "POST", body, headers: { "content-type": "application/json" }, keepalive: true });
    }
  };
  return {
    send,
    pageview(path, extra) {
      const payload: BeaconPayload = { type: "pageview", path, sessionId: config.sessionId };
      if (extra?.userId !== undefined) payload.userId = extra.userId;
      if (extra?.referrer !== undefined) payload.referrer = extra.referrer;
      send(payload);
    },
  };
}
