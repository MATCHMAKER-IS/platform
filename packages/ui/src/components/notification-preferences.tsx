"use client";
/**
 * 通知設定フォーム。既定チャネル・静音時間・カテゴリ別の受信方法を編集する（プレゼンテーション）。
 * @packageDocumentation
 */
import * as React from "react";
import { cn } from "../lib/cn";

/** 配信チャネル。 */
export type PrefChannel = "email" | "inApp" | "slack" | "line" | "sms" | "push";
/** 受信方法。 */
export type PrefMode = "immediate" | "digest" | "off";

/** フォームの値（NotificationPreference のサブセット）。 */
export interface PreferenceValue {
  defaultChannels: PrefChannel[];
  categories: Record<string, { channels: PrefChannel[]; mode: PrefMode }>;
  quietHours?: { start: number; end: number };
}

/** {@link NotificationPreferences} の props。 */
export interface NotificationPreferencesProps {
  value: PreferenceValue;
  onChange: (next: PreferenceValue) => void;
  /** 編集対象カテゴリ（キー→表示名）。 */
  categories?: { key: string; label: string }[];
  /** 選べるチャネル。 */
  channels?: { key: PrefChannel; label: string }[];
  onSave?: () => void;
  saving?: boolean;
  className?: string;
}

const DEFAULT_CATEGORIES = [
  { key: "mention", label: "メンション" },
  { key: "approval", label: "承認" },
  { key: "report", label: "レポート" },
];
const DEFAULT_CHANNELS: { key: PrefChannel; label: string }[] = [
  { key: "inApp", label: "アプリ内" },
  { key: "email", label: "メール" },
];
const MODES: { key: PrefMode; label: string }[] = [
  { key: "immediate", label: "即時" },
  { key: "digest", label: "まとめ" },
  { key: "off", label: "オフ" },
];

/** 通知設定フォーム。 */
/**
 * 通知の設定(何を受け取るか)。
 *
 * **全部を既定で有効にしない**。多すぎると全部切られる。
 * 業務上必要なもの(承認依頼)だけを既定で入れ、残りは選ばせる。
 */
export function NotificationPreferences({ value, onChange, categories = DEFAULT_CATEGORIES, channels = DEFAULT_CHANNELS, onSave, saving, className }: NotificationPreferencesProps) {
  const toggleDefault = (ch: PrefChannel) => {
    const has = value.defaultChannels.includes(ch);
    onChange({ ...value, defaultChannels: has ? value.defaultChannels.filter((c) => c !== ch) : [...value.defaultChannels, ch] });
  };
  const setCategoryMode = (key: string, mode: PrefMode) => {
    const cur = value.categories[key] ?? { channels: value.defaultChannels, mode: "immediate" as PrefMode };
    onChange({ ...value, categories: { ...value.categories, [key]: { ...cur, mode } } });
  };
  const setQuiet = (field: "start" | "end", n: number) => {
    const cur = value.quietHours ?? { start: 22, end: 7 };
    onChange({ ...value, quietHours: { ...cur, [field]: n } });
  };
  const quietEnabled = value.quietHours !== undefined;

  return (
    <div className={cn("flex flex-col gap-5", className)}>
      <section>
        <h3 className="mb-2 text-sm font-medium">既定の通知チャネル</h3>
        <div className="flex flex-wrap gap-3">
          {channels.map((c) => (
            <label key={c.key} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={value.defaultChannels.includes(c.key)} onChange={() => toggleDefault(c.key)} />
              {c.label}
            </label>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-medium">カテゴリ別の受信方法</h3>
        <div className="flex flex-col gap-2">
          {categories.map((cat) => {
            const mode = value.categories[cat.key]?.mode ?? "immediate";
            return (
              <div key={cat.key} className="flex items-center justify-between text-sm">
                <span>{cat.label}</span>
                <div className="flex gap-1">
                  {MODES.map((m) => (
                    <button
                      key={m.key}
                      onClick={() => setCategoryMode(cat.key, m.key)}
                      className={cn(
                        "rounded-md border px-2 py-1 text-xs",
                        mode === m.key ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-primary-fg,#fff)]" : "border-[var(--color-border)]",
                      )}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <label className="mb-2 flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={quietEnabled} onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...value, quietHours: e.target.checked ? { start: 22, end: 7 } : undefined })} />
          静音時間（この時間帯は緊急以外を配信しない）
        </label>
        {quietEnabled && (
          <div className="flex items-center gap-2 text-sm">
            <select value={value.quietHours!.start} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setQuiet("start", Number(e.target.value))} className="rounded border border-[var(--color-border)] px-2 py-1">
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>{h}時</option>
              ))}
            </select>
            <span>〜</span>
            <select value={value.quietHours!.end} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setQuiet("end", Number(e.target.value))} className="rounded border border-[var(--color-border)] px-2 py-1">
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>{h}時</option>
              ))}
            </select>
          </div>
        )}
      </section>

      {onSave && (
        <div>
          <button onClick={onSave} disabled={saving} className="rounded-[var(--radius)] bg-[var(--color-primary)] px-4 py-2 text-sm text-[var(--color-primary-fg,#fff)] disabled:opacity-50">
            {saving ? "保存中…" : "保存"}
          </button>
        </div>
      )}
    </div>
  );
}
