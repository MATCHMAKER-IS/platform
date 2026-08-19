/**
 * ブラウザ計測ビーコン。ページビュー等を計測エンドポイントへ送る。フレームワーク非依存。
 * navigator.sendBeacon があれば優先し、無ければ fetch(keepalive) にフォールバックする。
 * @packageDocumentation
 */
import { type AnalyticsEventType } from "./event";

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
 * @param current 既存の ID(Cookie など)
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
 * @param config.sessionId セッション ID。`endpoint` は送信先(既定 `/api/analytics`)、
 *   `sendBeacon` / `fetch` は送信手段の差し替え(テスト注入用)。
 *   **パスや参照元は送信時の引数で渡す**
 * @returns ビーコン(送信する形)
 */
/**
 * ブラウザの API を {@link createBeacon} に渡せる形で取り出す。
 *
 * **`navigator` や `document` を直に触らない。** サーバでも動く経路
 * (Next.js の SSR・テスト)では**存在しない**ので、`globalThis` 越しに
 * 有無を確かめてから渡す必要がある——**触ると `ReferenceError` で画面が落ちる**。
 *
 * この取り出しは `internal-app` と `public-site` で**同じものが書かれていた**ので
 * 基盤へ移した(2026-08)。
 *
 * **`sendBeacon` が使えない環境では省く。** 渡さなければ `createBeacon` が
 * `fetch` に落とすので、**古いブラウザでも計測は続く**。
 *
 * @returns `createBeacon` に渡す依存(`sendBeacon` は使える場合のみ入る)
 *
 * @example
 * ```ts
 * const beacon = createBeacon({ sessionId, ...browserBeaconDeps() });
 * ```
 */
export function browserBeaconDeps(): BeaconDeps & { pathname: string; referrer: string } {
  const g = globalThis as unknown as {
    navigator?: { sendBeacon?: (u: string, b: BodyInit) => boolean };
    location?: { pathname: string };
    document?: { referrer: string };
  };
  return {
    // **`sendBeacon` は「あれば使う」。** ページを閉じる瞬間でも送れるので
    // `fetch` より確実だが、古いブラウザには無い
    ...(g.navigator?.sendBeacon !== undefined
      ? { sendBeacon: (u: string, b: string): boolean => g.navigator!.sendBeacon!(u, b) }
      : {}),
    fetch: (u, init) => fetch(u, init as RequestInit),
    pathname: g.location?.pathname ?? "/",
    referrer: g.document?.referrer ?? "",
  };
}

/**
 * 画面の出来事を**サーバへ送る器**を作る。
 *
 * **`sendBeacon` を使うので、画面を閉じても届きます**——
 * 普通の `fetch` だと、**離脱の記録が一番欲しいときに消えます**。
 *
 * **個人情報を送らないでください。** 画面の URL に ID が入ることがあるので、
 * **送る前に伏せる**か、そもそも含めない設計にしてください。
 *
 * @param config 送り先の URL と、まとめて送る間隔
 * @returns 出来事を積む器
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
