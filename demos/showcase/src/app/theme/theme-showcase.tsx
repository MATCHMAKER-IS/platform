"use client";
/**
 * テーマ機構(@platform/theme)のショーケース。
 * 11 スキンの一覧、選択スキンのトークン(色・角丸・フォント)、WCAG コントラスト検査結果を見せる。
 * スキンを切り替えると、この画面全体が CSS 変数経由で即座に変わる。
 */
import * as React from "react";
import { builtInThemes, checkTheme, type ThemeMode } from "@platform/theme";
import { useSkin, SkinSelector } from "@platform/ui";

function swatches(id: string): string[] {
  const t = builtInThemes.find((x) => x.id === id);
  if (!t) return [];
  const m = t.modes.light;
  return [m.primary, m.accent, m.surface, m.border];
}

function TokenTable({ mode }: { mode: ThemeMode }) {
  const { skin } = useSkin();
  const tokens = skin.modes[mode];
  const entries = Object.entries(tokens);
  return (
    <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius)", padding: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>{mode === "light" ? "ライト" : "ダーク"}トークン</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
        {entries.map(([k, v]) => (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
            <span style={{ width: 14, height: 14, borderRadius: 3, background: v, border: "1px solid rgba(0,0,0,.15)" }} />
            <code>{k}</code>
            <span style={{ color: "var(--color-muted)" }}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function A11yReport() {
  const { skin } = useSkin();
  const reports = checkTheme(skin);
  return (
    <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius)", padding: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>アクセシビリティ(WCAG コントラスト)</div>
      {reports.map((rep) => (
        <div key={rep.mode} style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 11, color: "var(--color-muted)", marginBottom: 4 }}>{rep.mode === "light" ? "ライト" : "ダーク"}（{rep.passesAA ? "AA 達成" : "一部 AA 未達"}）</div>
          {rep.checks.map((c, i) => {
            const color = c.level === "fail" ? "var(--color-danger)" : c.level === "AAA" ? "var(--color-success)" : "var(--color-warning)";
            return (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, padding: "2px 0" }}>
                <span>{c.label}</span>
                <span style={{ color }}>{c.ratio}:1 {c.level}</span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function ThemeShowcase() {
  const { skin } = useSkin();
  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 24, background: "var(--color-bg)", color: "var(--color-fg)", minHeight: "100vh" }}>
      <h1 style={{ fontSize: 22 }}>テーマ機構（@platform/theme）</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted)", lineHeight: 1.6 }}>
        11 種の標準スキン。色・フォント・角丸・余白を 1 セットにして切り替えられます（明暗と直交）。
        後から <code>registry.register()</code> で追加できます。下のスキンを選ぶと画面全体が変わります。
      </p>

      <div style={{ margin: "16px 0" }}>
        <SkinSelector variant="grid" swatches={swatches} />
      </div>

      <div style={{ fontSize: 13, marginBottom: 12 }}>
        選択中: <strong>{skin.name}</strong> — {skin.description}
        <span style={{ color: "var(--color-muted)" }}>（フォント {skin.shape.fontFamily.split(",")[0]} / 角丸 {skin.shape.radius}px / 余白 {skin.shape.spacing}px）</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <TokenTable mode="light" />
        <TokenTable mode="dark" />
      </div>
      <A11yReport />
    </div>
  );
}
