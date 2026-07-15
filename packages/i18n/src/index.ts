/**
 * 軽量 i18n。翻訳カタログ + 補間 + フォールバック + Intl 整形(数値/通貨/日付/相対時間/複数形)。
 * @packageDocumentation
 */

/** 対応ロケール。 */
export type Locale = "ja" | "en" | "zh" | "ko";

/** 全対応ロケール。 */
export const LOCALES: Locale[] = ["ja", "en", "zh", "ko"];

/** ロケールの表示名(自言語)。 */
export const LOCALE_LABELS: Record<Locale, string> = { ja: "日本語", en: "English", zh: "中文", ko: "한국어" };

/** 平坦化した翻訳カタログ(キー→文言)。ネストは "a.b.c" のドット記法。 */
export type Catalog = Record<string, string>;

/** ロケール別カタログ。 */
export type Catalogs = Partial<Record<Locale, Catalog>>;

/** 補間パラメータ。 */
export type TransParams = Record<string, string | number>;

function interpolate(template: string, params?: TransParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_m, k) => (k in params ? String(params[k]) : `{${k}}`));
}

/** 翻訳器。 */
export interface Translator {
  locale: Locale;
  /** キーを翻訳(無ければ fallback→キー)。 */
  t(key: string, params?: TransParams): string;
  /** 数値整形。 */
  n(value: number, options?: Intl.NumberFormatOptions): string;
  /** 通貨整形(既定 JPY)。 */
  currency(value: number, currency?: string): string;
  /** 日付整形。 */
  date(value: Date | string | number, options?: Intl.DateTimeFormatOptions): string;
  /** 相対時間(例: 3日前)。 */
  relativeTime(value: number, unit: Intl.RelativeTimeFormatUnit): string;
  /** 複数形の選択。 */
  plural(count: number, forms: Partial<Record<Intl.LDMLPluralRule, string>>): string;
}

const LOCALE_TAG: Record<Locale, string> = { ja: "ja-JP", en: "en-US", zh: "zh-CN", ko: "ko-KR" };
const DEFAULT_CURRENCY: Record<Locale, string> = { ja: "JPY", en: "USD", zh: "CNY", ko: "KRW" };

/** {@link createI18n} のオプション。 */
export interface I18nOptions {
  locale: Locale;
  catalogs: Catalogs;
  fallbackLocale?: Locale;
}

/** 翻訳器を作る。 */
export function createI18n(options: I18nOptions): Translator {
  const { locale, catalogs, fallbackLocale = "en" } = options;
  const tag = LOCALE_TAG[locale];
  const primary = catalogs[locale] ?? {};
  const fallback = catalogs[fallbackLocale] ?? {};

  return {
    locale,
    t(key, params) {
      const raw = primary[key] ?? fallback[key] ?? key;
      return interpolate(raw, params);
    },
    n(value, opts) { return new Intl.NumberFormat(tag, opts).format(value); },
    currency(value, currency) { return new Intl.NumberFormat(tag, { style: "currency", currency: currency ?? DEFAULT_CURRENCY[locale] }).format(value); },
    date(value, opts) { return new Intl.DateTimeFormat(tag, opts ?? { dateStyle: "medium" }).format(new Date(value)); },
    relativeTime(value, unit) { return new Intl.RelativeTimeFormat(tag, { numeric: "auto" }).format(value, unit); },
    plural(count, forms) {
      const rule = new Intl.PluralRules(tag).select(count);
      return interpolate(forms[rule] ?? forms.other ?? "", { count });
    },
  };
}

/** 複数カタログを結合する(名前空間プレフィックス付与も可)。 */
export function mergeCatalogs(...catalogsList: Catalogs[]): Catalogs {
  const out: Catalogs = {};
  for (const cs of catalogsList) {
    for (const loc of Object.keys(cs) as Locale[]) {
      out[loc] = { ...(out[loc] ?? {}), ...(cs[loc] ?? {}) };
    }
  }
  return out;
}


/** カタログの全キーに "prefix." を付与する(ドメイン別辞書の名前空間化)。 */
export function namespaced(prefix: string, catalogs: Catalogs): Catalogs {
  const out: Catalogs = {};
  for (const loc of Object.keys(catalogs) as Locale[]) {
    const cat = catalogs[loc]!;
    const nc: Catalog = {};
    for (const k of Object.keys(cat)) nc[`${prefix}.${k}`] = cat[k]!;
    out[loc] = nc;
  }
  return out;
}

/** ブラウザ等の言語文字列から対応ロケールを推定する。 */
export function detectLocale(input: string | undefined, fallback: Locale = "en"): Locale {
  if (!input) return fallback;
  const lower = input.toLowerCase();
  if (lower.startsWith("ja")) return "ja";
  if (lower.startsWith("zh")) return "zh";
  if (lower.startsWith("ko")) return "ko";
  if (lower.startsWith("en")) return "en";
  return fallback;
}
