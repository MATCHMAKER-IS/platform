"use client";
/**
 * 通知設定画面。/api/notifications/preferences を GET/PUT し、NotificationPreferences で編集する。
 * @packageDocumentation
 */
import * as React from "react";
import { NotificationPreferences, Select, type PreferenceValue } from "@platform/ui";

const EMPTY: PreferenceValue = { defaultChannels: ["inApp", "email"], categories: {} };

export interface PreferencesClientProps {
  fetchImpl?: typeof fetch;
}

export function PreferencesClient({ fetchImpl }: PreferencesClientProps) {
  const [value, setValue] = React.useState<PreferenceValue>(EMPTY);
  const [saving, setSaving] = React.useState(false);
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;

  React.useEffect(() => {
    let alive = true;
    (async () => {
      const res = await doFetch("/api/notifications/preferences");
      if (!alive || !res.ok) return;
      const data = (await res.json()) as { preference: Partial<PreferenceValue> };
      setValue({ defaultChannels: data.preference.defaultChannels ?? ["inApp", "email"], categories: data.preference.categories ?? {}, ...(data.preference.quietHours ? { quietHours: data.preference.quietHours } : {}) });
    })();
    return () => {
      alive = false;
    };
  }, []);

  const onSave = async () => {
    setSaving(true);
    await doFetch("/api/notifications/preferences", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(value) });
    setSaving(false);
  };

  const [digestFreq, setDigestFreq] = React.useState<"off" | "daily" | "weekly">("off");
  const [digestSaved, setDigestSaved] = React.useState(false);
  React.useEffect(() => {
    (async () => {
      const res = await doFetch("/api/notifications/digest");
      if (res.ok) { const d = (await res.json()) as { setting: { frequency: "off" | "daily" | "weekly" } }; setDigestFreq(d.setting.frequency); }
    })();
  }, []);
  const saveDigest = async (freq: "off" | "daily" | "weekly") => {
    setDigestFreq(freq);
    await doFetch("/api/notifications/digest", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ frequency: freq }) });
    setDigestSaved(true);
  };

  return (
    <div>
      <NotificationPreferences value={value} onChange={setValue} onSave={onSave} saving={saving} />
      <div className="mx-auto mt-6 max-w-xl rounded border border-neutral-200 p-4">
        <h2 className="mb-1 text-sm font-semibold">ダイジェスト配信</h2>
        <p className="mb-2 text-xs text-neutral-500">未読通知のまとめを受け取る頻度を選びます。</p>
        <Select value={digestFreq} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => void saveDigest(e.target.value as "off" | "daily" | "weekly")} className="rounded border border-neutral-300 px-2 py-1 text-sm" options={[{ label: "受け取らない", value: "off" }, { label: "毎日", value: "daily" }, { label: "毎週", value: "weekly" }]} />
        {digestSaved && <span className="ml-2 text-xs text-green-600">保存しました</span>}
      </div>
    </div>
  );
}
