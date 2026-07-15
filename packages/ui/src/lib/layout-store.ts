/**
 * レイアウト保存アダプタ。localStorage 実装と、DB 用の非同期ストアインターフェイス。
 * @packageDocumentation
 */
import type { DashboardLayout } from "./layout.js";

/** レイアウトの保存先。load/save のみ(同期・非同期どちらも可)。 */
export interface LayoutStore {
  load(): DashboardLayout | null | Promise<DashboardLayout | null>;
  save(layout: DashboardLayout): void | Promise<void>;
}

/** localStorage に保存するストアを作る(ブラウザ専用)。 */
export function createLocalStorageLayoutStore(key: string): LayoutStore {
  return {
    load() {
      if (typeof localStorage === "undefined") return null;
      try {
        const raw = localStorage.getItem(key);
        return raw ? (JSON.parse(raw) as DashboardLayout) : null;
      } catch { return null; }
    },
    save(layout) {
      if (typeof localStorage === "undefined") return;
      try { localStorage.setItem(key, JSON.stringify(layout)); } catch { /* 容量超過等は無視 */ }
    },
  };
}

/** {@link createFetchLayoutStore} のオプション。 */
export interface FetchLayoutStoreOptions {
  /** 保存時の HTTP メソッド(既定 "PUT")。 */
  method?: string;
  /** 追加ヘッダ(認可トークン等)。 */
  headers?: Record<string, string>;
  /** fetch 実装の注入(テスト・SSR 用)。 */
  fetch?: typeof fetch;
}

/**
 * サーバ(DB)にレイアウトを保存するストアを作る。
 * GET でロード、PUT(既定)でセーブする単純な REST アダプタ。
 *
 * @example
 * ```ts
 * // サーバ側: GET /api/dashboard/layout → DashboardLayout, PUT で保存
 * const store = createFetchLayoutStore("/api/dashboard/layout", {
 *   headers: { authorization: `Bearer ${token}` },
 * });
 * const { layout, setLayout } = useDashboardLayout(DEFAULT, store);
 * ```
 */
export function createFetchLayoutStore(url: string, options: FetchLayoutStoreOptions = {}): LayoutStore {
  const doFetch = options.fetch ?? (typeof fetch !== "undefined" ? fetch : undefined);
  return {
    async load() {
      if (!doFetch) return null;
      try {
        const res = await doFetch(url, { headers: options.headers });
        if (!res.ok) return null;
        return (await res.json()) as DashboardLayout;
      } catch { return null; }
    },
    async save(layout) {
      if (!doFetch) return;
      await doFetch(url, {
        method: options.method ?? "PUT",
        headers: { "content-type": "application/json", ...options.headers },
        body: JSON.stringify(layout),
      });
    },
  };
}
