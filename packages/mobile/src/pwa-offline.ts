/**
 * オフライン対応(Service Worker)とプッシュ通知。
 *
 * 倉庫・工場・外回りでは**電波が不安定**な場所で画面が開かれる。
 * 「圏外になった瞬間に真っ白」を避けることが、現場での実用性を大きく変える。
 *
 * Service Worker のコードは**文字列として生成**する。
 * ビルドの設定に手を入れず、`/sw.js` を返すルートを 1 本足すだけで済むようにするため。
 * @packageDocumentation
 */

/** キャッシュのしかた。 */
export type CacheStrategy =
  /** まずネットワーク。失敗したらキャッシュ。**更新が大事なもの**(一覧・詳細) */
  | "network-first"
  /** まずキャッシュ。無ければネットワーク。**変わらないもの**(アイコン・フォント) */
  | "cache-first"
  /** キャッシュを返しつつ裏で更新。**速さが大事なもの** */
  | "stale-while-revalidate";

/** URL の型ごとの扱い。 */
export interface CacheRule {
  /** 対象の URL に含まれる文字列、または正規表現の元になる文字列。 */
  pattern: string;
  strategy: CacheStrategy;
  /** キャッシュの名前(分けておくと後から消しやすい)。 */
  cacheName?: string;
}

/** Service Worker の設定。 */
export interface ServiceWorkerConfig {
  /** キャッシュの版。**変えると古いキャッシュが捨てられる**(更新時に必ず変える)。 */
  version: string;
  /** 最初に読み込んでおくもの(オフラインでも出したい画面)。 */
  precache?: string[];
  /** オフライン時に出すページ。 */
  offlineFallback?: string;
  /** URL ごとの扱い。 */
  rules?: CacheRule[];
}

/**
 * Service Worker のコードを組み立てる。
 *
 * **API の応答をキャッシュしない**のが既定。古い在庫数や承認状態を見せると、
 * オフラインで見えること以上の害になる。キャッシュするのは画面と静的ファイルだけにする。
 *
 * @param config 版・先読み・オフライン時のページ
 * @returns `/sw.js` として返す JavaScript
 *
 * @example
 * ```ts
 * // app/sw.js/route.ts
 * export function GET() {
 *   return new Response(buildServiceWorker({
 *     version: "2026-07-23",
 *     precache: ["/", "/offline"],
 *     offlineFallback: "/offline",
 *   }), { headers: { "Content-Type": "text/javascript" } });
 * }
 * ```
 */
export function buildServiceWorker(config: ServiceWorkerConfig): string {
  const cacheName = `app-${config.version}`;
  const precache = JSON.stringify(config.precache ?? ["/"]);
  const fallback = config.offlineFallback ?? "";
  const rules = JSON.stringify(config.rules ?? []);

  return `// 自動生成(@platform/mobile の buildServiceWorker)。手で編集しない。
// 版: ${config.version}
const CACHE = ${JSON.stringify(cacheName)};
const PRECACHE = ${precache};
const FALLBACK = ${JSON.stringify(fallback)};
const RULES = ${rules};

self.addEventListener("install", (event) => {
  // 先読みしておく。失敗しても install 自体は通す(1 つの失敗で全部止めない)
  event.waitUntil(
    caches.open(CACHE).then((c) => Promise.allSettled(PRECACHE.map((u) => c.add(u)))).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  // 版が変わったら古いキャッシュを捨てる
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function strategyFor(url) {
  for (const r of RULES) {
    if (url.includes(r.pattern)) return r.strategy;
  }
  return null;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  // 取得以外(送信・更新)はそのまま通す。キャッシュすると二重送信になる
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // 別ドメインは触らない
  if (url.origin !== self.location.origin) return;

  const strategy = strategyFor(url.pathname);

  // 既定では API をキャッシュしない。古い在庫数や承認状態を見せる方が害が大きい
  if (!strategy && url.pathname.startsWith("/api/")) return;

  if (strategy === "cache-first") {
    event.respondWith(
      caches.match(req).then((hit) => hit ?? fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      })),
    );
    return;
  }

  if (strategy === "stale-while-revalidate") {
    event.respondWith(
      caches.match(req).then((hit) => {
        const network = fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        }).catch(() => hit);
        return hit ?? network;
      }),
    );
    return;
  }

  // 既定: まずネットワーク。失敗したらキャッシュ、それも無ければオフライン用の画面
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && req.destination === "document") {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit ?? (FALLBACK ? caches.match(FALLBACK) : undefined))),
  );
});

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload = {};
  try { payload = event.data.json(); } catch { payload = { title: event.data.text() }; }
  event.waitUntil(
    self.registration.showNotification(payload.title || "お知らせ", {
      body: payload.body,
      icon: payload.icon || "/icon-192.png",
      badge: payload.badge,
      tag: payload.tag,
      data: { url: payload.url || "/" },
      requireInteraction: payload.requireInteraction === true,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data && event.notification.data.url;
  event.waitUntil(
    // 既に開いているタブがあれば、そこへ移動する(タブを増やさない)
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(target) && "focus" in client) return client.focus();
      }
      return self.clients.openWindow(target || "/");
    }),
  );
});
`;
}

/** プッシュ通知の中身。 */
export interface PushPayload {
  title: string;
  body?: string;
  /** 押したときに開く URL。 */
  url?: string;
  icon?: string;
  badge?: string;
  /** 同じ tag の通知は上書きされる(同じ件で何度も鳴らさない)。 */
  tag?: string;
  /** 利用者が閉じるまで残す(重要な通知のみ)。 */
  requireInteraction?: boolean;
}

/** 通知の許可の状態。 */
export type PushPermission = "granted" | "denied" | "default" | "unsupported";

/**
 * プッシュ通知が使えるかを判定する。
 *
 * **iOS は 16.4 以降、かつホーム画面に追加していないと使えない。**
 * ブラウザのタブで開いている状態では、許可を求めても失敗する。
 *
 * @param options 端末の状況
 * @returns 使えるかと、使えない理由
 */
export function pushAvailability(options: {
  userAgent: string;
  /** ホーム画面から起動しているか(`display-mode: standalone`)。 */
  isStandalone: boolean;
  /** Notification API があるか。 */
  hasNotificationApi: boolean;
}): { available: boolean; reason?: string } {
  if (!options.hasNotificationApi) {
    return { available: false, reason: "この端末は通知に対応していません" };
  }
  const ua = options.userAgent.toLowerCase();
  const isIos = /iphone|ipad|ipod/.test(ua);
  if (isIos && !options.isStandalone) {
    return {
      available: false,
      reason: "iOS では、ホーム画面に追加してから開くと通知を受け取れます",
    };
  }
  return { available: true };
}

/**
 * 通知の許可を求めるべきタイミングかを判断する。
 *
 * **開いた直後に求めない。** 何のための通知か分からないまま拒否されると、
 * その後は設定画面から変えてもらうしかなくなる(拒否は覚えられる)。
 *
 * @param state 現在の状況
 * @returns 求めてよいか
 */
export function shouldAskPushPermission(state: {
  permission: PushPermission;
  /** 利用者が通知を要する操作をしたか(承認依頼を出した、など)。 */
  didRelevantAction: boolean;
  /** 前回尋ねてからの日数。 */
  daysSinceLastAsk?: number;
}): boolean {
  if (state.permission !== "default") return false;   // 既に許可/拒否済み
  if (!state.didRelevantAction) return false;          // 文脈が無いのに求めない
  // 一度断られたら間を空ける(しつこいと設定ごと切られる)
  return (state.daysSinceLastAsk ?? Infinity) >= 30;
}
