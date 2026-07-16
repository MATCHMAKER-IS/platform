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

/**
 * セッション ID を用意する(**無ければ作る**)。
 *
 * @param existing 既存の ID(Cookie など)
 * @param generate ID を作る関数
 * @returns セッション ID
 */
export function ensureSessionId(current: string | null | undefined, generate: () => string): string {
  return current && current.length > 0 ? current : generate();
}

/**
 * 計測ビーコンを作る。
 *
 * **個人を特定する情報を入れないこと**。パスにユーザー ID や検索語が入ると、
 * 意図せず個人情報を計測基盤に送ることになる。
 *
 * @param input パス・セッション ID・参照元など
 * @param now 現在時刻(テスト注入用)
 * @returns ビーコン(送信する形)
 */
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
