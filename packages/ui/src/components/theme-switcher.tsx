"use client";
/**
 * ヘッダーなどに置くコンパクトなテーマ切替。SkinSelector の dropdown を小さくまとめたもの。
 * AppSkin(SkinProvider)の内側で使う。ラベルを省略でき、ナビバーに収まりやすい。
 * @packageDocumentation
 */
import * as React from "react";
import { useSkin } from "./skin-provider.js";

export interface ThemeSwitcherProps {
  /** ラベルを表示するか(既定 true)。 */
  showLabel?: boolean;
}

export function ThemeSwitcher({ showLabel = true }: ThemeSwitcherProps) {
  const { skinId, available, setSkin } = useSkin();
  return (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--color-muted, #888)" }}>
      {showLabel && <span>テーマ</span>}
      <select
        value={skinId}
        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSkin(e.target.value)}
        aria-label="デザインテーマ"
        style={{ padding: "4px 8px", borderRadius: "var(--radius, 6px)", border: "1px solid var(--color-border, #ddd)", background: "var(--color-surface, #fff)", color: "var(--color-fg, #111)", fontSize: 12 }}
      >
        {available.map((s) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>
    </label>
  );
}
