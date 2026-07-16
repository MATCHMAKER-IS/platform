"use client";
/**
 * 保存済みロケールをロードし、変更時に保存するフック。
 * @packageDocumentation
 */
import * as React from "react";
import type { Locale } from "@platform/i18n";
import type { LocaleStore } from "../lib/locale-store";

/**
 * ロケール設定フック。
 *
 * @param options.supported 対応するロケール
 * @param options.fallback 既定
 */
export function useLocalePreference(store: LocaleStore, fallback: Locale = "ja") {
  const [locale, setLocaleState] = React.useState<Locale>(fallback);
  React.useEffect(() => {
    let active = true;
    void store.load().then((l) => { if (active && l) setLocaleState(l); });
    return () => { active = false; };
  }, [store]);
  const setLocale = React.useCallback((l: Locale) => { setLocaleState(l); void store.save(l); }, [store]);
  return { locale, setLocale };
}
