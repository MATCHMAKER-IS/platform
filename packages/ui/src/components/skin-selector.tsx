"use client";
/**
 * スキン選択 UI。登録済みスキンを一覧し、クリックで切り替える。各スキンの主要色を
 * 小さなスウォッチでプレビューする。useSkin() 経由で SkinProvider と連携。
 * @packageDocumentation
 */
import * as React from "react";
import { useSkin } from "./skin-provider";

export interface SkinSelectorProps {
  /** レイアウト。"grid"(カード)または "dropdown"(セレクトボックス)。既定 "grid"。 */
  variant?: "grid" | "dropdown";
  /** 各スキンのプレビュー色を得る関数(id → 主要色4つ)。省略時は空。 */
  swatches?: (id: string) => string[];
}

export function SkinSelector({ variant = "grid", swatches }: SkinSelectorProps) {
  const { skinId, available, setSkin } = useSkin();

  if (variant === "dropdown") {
    return (
      <select
        value={skinId}
        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSkin(e.target.value)}
        aria-label="デザインテーマ"
        style={{ padding: "6px 10px", borderRadius: "var(--radius, 6px)", border: "1px solid var(--color-border, #ddd)", background: "var(--color-surface, #fff)", color: "var(--color-fg, #111)" }}
      >
        {available.map((s) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
      {available.map((s) => {
        const active = s.id === skinId;
        const colors = swatches?.(s.id) ?? [];
        return (
          <button
            key={s.id}
            onClick={() => setSkin(s.id)}
            aria-pressed={active}
            style={{
              textAlign: "left",
              padding: 12,
              borderRadius: "var(--radius, 8px)",
              border: active ? "2px solid var(--color-primary, #2563eb)" : "1px solid var(--color-border, #e5e7eb)",
              background: "var(--color-surface, #fff)",
              color: "var(--color-fg, #111)",
              cursor: "pointer",
            }}
          >
            <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
              {colors.map((c, i) => (
                <span key={i} style={{ width: 20, height: 20, borderRadius: 4, background: c, border: "1px solid rgba(0,0,0,.1)" }} />
              ))}
            </div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{s.name}</div>
            {s.description && <div style={{ fontSize: 11, color: "var(--color-muted, #6b7280)", marginTop: 2 }}>{s.description}</div>}
            {active && <div style={{ fontSize: 11, color: "var(--color-primary, #2563eb)", marginTop: 4 }}>使用中</div>}
          </button>
        );
      })}
    </div>
  );
}
