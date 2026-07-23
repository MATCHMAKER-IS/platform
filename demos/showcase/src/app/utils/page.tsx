"use client";
/** ユーティリティ関数の統合デモ（変換・数値・文字列をタブでまとめたもの）。 */
import * as React from "react";
import { Button } from "@platform/ui";
import { ConvertersDemo } from "./converters-demo";
import { NumbersDemo } from "./numbers-demo";
import { StringsDemo } from "./strings-demo";

const TABS = [
  { id: "convert", label: "変換（電話・通貨・単位）", Comp: ConvertersDemo },
  { id: "numbers", label: "数値・統計", Comp: NumbersDemo },
  { id: "strings", label: "文字列", Comp: StringsDemo },
] as const;

export default function Page() {
  const [tab, setTab] = React.useState<string>("convert");
  const Active = (TABS.find((t) => t.id === tab) ?? TABS[0]).Comp;
  return (
    <main style={{ maxWidth: 1000, margin: "2rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 12 }}>ユーティリティ関数</h1>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12, borderBottom: "1px solid var(--color-border)", paddingBottom: 10 }}>
        {TABS.map((t) => (
          <Button key={t.id} type="button" onClick={() => setTab(t.id)}
            style={{ fontSize: 13, padding: "6px 14px", borderRadius: 8, cursor: "pointer", border: "1px solid var(--color-border)", background: tab === t.id ? "var(--color-primary)" : "var(--color-bg)", color: tab === t.id ? "var(--color-primary-fg)" : "var(--color-fg)" }}>
            {t.label}</Button>))}
      </div>
      <Active />
    </main>
  );
}
