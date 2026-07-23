"use client";
/** 言語切替。/api/i18n から利用可能ロケールを取得し、選択言語の文言を親へ渡す。 */
import * as React from "react";
import { Select } from "@platform/ui";

interface I18nData { locale: string; locales: { code: string; label: string }[]; messages: Record<string, string>; }

export function LanguageSwitcher({ fetchImpl, onChange }: { fetchImpl?: typeof fetch; onChange?: (messages: Record<string, string>, locale: string) => void }) {
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;
  const [data, setData] = React.useState<I18nData | null>(null);
  const load = React.useCallback(async (locale: string) => { const r = await doFetch(`/api/i18n?locale=${locale}`); if (r.ok) { const d = (await r.json()) as I18nData; setData(d); if (onChange) onChange(d.messages, d.locale); } }, [doFetch, onChange]);
  React.useEffect(() => { void load("ja"); }, [load]);
  if (!data) return null;
  return (
    <Select value={data.locale} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => void load(e.target.value)} className="rounded border border-neutral-300 px-2 py-1 text-xs" aria-label="言語" options={[...data.locales.map((l) => ({ label: l.label, value: String(l.code) }))]} />
  );
}
