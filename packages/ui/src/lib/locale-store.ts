/**
 * 言語選択の永続化(localStorage / サーバ)。純ロジック(React 非依存)。
 * @packageDocumentation
 */
import { LOCALES, type Locale } from "@platform/i18n";

/** ロケール保存先。 */
export interface LocaleStore {
  load(): Promise<Locale | null>;
  save(locale: Locale): Promise<void>;
}

/**
 * 文字列が対応ロケールか。
 *
 *
 * @param value 判定する値
 * @returns 対応するロケールなら true(**型ガード**)
 */
export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALES as string[]).includes(v);
}

/**
 * localStorage に保存するストア。
 *
 *
 * @param key 保存キー
 * @returns ストア
 */
export function createLocalStorageLocaleStore(key = "app.locale"): LocaleStore {
  return {
    async load() {
      if (typeof localStorage === "undefined") return null;
      const v = localStorage.getItem(key);
      return isLocale(v) ? v : null;
    },
    async save(locale) {
      if (typeof localStorage === "undefined") return;
      localStorage.setItem(key, locale);
    },
  };
}

/**
 * サーバにユーザー別で保存するストア。
 *
 *
 * @param options.endpoint API の URL
 * @returns ストア(**端末をまたいで言語設定を持ち回れる**)
 */
export function createFetchLocaleStore(options: { endpoint: string; userId: string; headers?: Record<string, string>; fetch?: typeof fetch }): LocaleStore {
  const doFetch = options.fetch ?? (typeof fetch !== "undefined" ? fetch : undefined);
  const url = `${options.endpoint}?user=${encodeURIComponent(options.userId)}`;
  return {
    async load() {
      if (!doFetch) return null;
      try {
        const res = await doFetch(url, { headers: options.headers });
        if (!res.ok) return null;
        const data = (await res.json()) as { locale?: string };
        return isLocale(data.locale) ? data.locale : null;
      } catch { return null; }
    },
    async save(locale) {
      if (!doFetch) return;
      await doFetch(url, { method: "PUT", headers: { "content-type": "application/json", ...options.headers }, body: JSON.stringify({ userId: options.userId, locale }) });
    },
  };
}
