"use client";
/**
 * ダッシュボードのウィジェット表示設定フォーム（チェックボックス）。
 * @packageDocumentation
 */
import * as React from "react";
import { cn } from "../lib/cn";

/** {@link DashboardSettings} の props。 */
export interface DashboardSettingsProps {
  /** 全ウィジェット（キー→表示名）。 */
  all: { key: string; label: string }[];
  /** 現在表示中のウィジェットキー。 */
  visible: string[];
  onChange: (next: string[]) => void;
  onSave?: () => void;
  saving?: boolean;
  className?: string;
}

/** ウィジェット表示設定。 */
export function DashboardSettings({ all, visible, onChange, onSave, saving, className }: DashboardSettingsProps) {
  const toggle = (key: string) => {
    // 元の順序（all）を保ちながらトグルする
    const set = new Set(visible);
    if (set.has(key)) set.delete(key);
    else set.add(key);
    onChange(all.filter((w) => set.has(w.key)).map((w) => w.key));
  };
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-col gap-2">
        {all.map((w) => (
          <label key={w.key} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={visible.includes(w.key)} onChange={() => toggle(w.key)} />
            {w.label}
          </label>
        ))}
      </div>
      {onSave && (
        <button onClick={onSave} disabled={saving} className="w-fit rounded-[var(--radius)] bg-[var(--color-primary)] px-4 py-2 text-sm text-[var(--color-primary-fg,#fff)] disabled:opacity-50">
          {saving ? "保存中…" : "保存"}
        </button>
      )}
    </div>
  );
}
