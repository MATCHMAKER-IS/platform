"use client";
/** 請求・インボイス・税の統合デモ（請求書帳票・インボイス作成・消費税計算をタブでまとめたもの）。 */
import * as React from "react";
import { Button } from "@platform/ui";
import { InvoiceDemo } from "./invoice-demo";
import { InvoiceBuilderDemo } from "./builder-demo";
import { TaxDemo } from "./tax-demo";

const TABS = [
  { id: "invoice", label: "請求書（帳票）", Comp: InvoiceDemo },
  { id: "builder", label: "インボイス作成", Comp: InvoiceBuilderDemo },
  { id: "tax", label: "消費税・インボイス計算", Comp: TaxDemo },
] as const;

export default function Page() {
  const [tab, setTab] = React.useState<string>("invoice");
  const Active = (TABS.find((t) => t.id === tab) ?? TABS[0]).Comp;
  return (
    <main style={{ maxWidth: 1000, margin: "2rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 12 }}>請求・インボイス・税</h1>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12, borderBottom: "1px solid var(--color-border)", paddingBottom: 10 }}>
        {TABS.map((t) => (<Button key={t.id} type="button" onClick={() => setTab(t.id)}
          style={{ fontSize: 13, padding: "6px 14px", borderRadius: 8, cursor: "pointer", border: "1px solid var(--color-border)", background: tab === t.id ? "var(--color-primary)" : "var(--color-bg)", color: tab === t.id ? "var(--color-primary-fg)" : "var(--color-fg)" }}>{t.label}</Button>))}
      </div>
      <Active />
    </main>
  );
}
