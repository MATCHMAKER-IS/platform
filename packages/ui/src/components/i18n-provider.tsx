"use client";
/**
 * ロケール文脈。<LocaleProvider> 未設定でも既定(日本語 + 基盤カタログ)で動作する。
 * @packageDocumentation
 */
import * as React from "react";
import { createI18n, type Catalogs, type Locale, type Translator } from "@platform/i18n";
import { uiCatalogs } from "@platform/i18n/catalogs";

const defaultTranslator = createI18n({ locale: "ja", catalogs: uiCatalogs });
const I18nContext = React.createContext<Translator>(defaultTranslator);

/** {@link LocaleProvider} の props。 */
export interface LocaleProviderProps {
  locale: Locale;
  catalogs: Catalogs;
  fallbackLocale?: Locale;
  children: React.ReactNode;
}

/** ロケールプロバイダ。 */
export function LocaleProvider({ locale, catalogs, fallbackLocale, children }: LocaleProviderProps) {
  const translator = React.useMemo(() => createI18n({ locale, catalogs, fallbackLocale }), [locale, catalogs, fallbackLocale]);
  return <I18nContext.Provider value={translator}>{children}</I18nContext.Provider>;
}

/** 翻訳器を取得する(Provider 外では既定の日本語翻訳器)。 */
export function useI18n(): Translator {
  return React.useContext(I18nContext);
}

/** t だけを取り出すショートカット。 */
export function useT(): Translator["t"] {
  return useI18n().t;
}
