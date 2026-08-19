"use client";
import * as React from "react";
import { Button } from "@platform/ui";
import { FreeeDemo } from "./freee-demo";
import { GoogleDemo } from "./google-demo";
import { ZohoDemo } from "./zoho-demo";
const TABS = [{ id: "a", label: "freee会計", Comp: FreeeDemo }, { id: "b", label: "Google Workspace", Comp: GoogleDemo }, { id: "c", label: "Zoho", Comp: ZohoDemo }] as const;
export default function Page() {
  const [tab, setTab] = React.useState<string>("a");
  const Active = (TABS.find((t) => t.id === tab) ?? TABS[0]).Comp;
  return (
    <main style={{ maxWidth: 1000, margin: "2rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 12 }}>SaaS連携（freee/Google/Zoho）</h1>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12, borderBottom: "1px solid var(--color-border)", paddingBottom: 10 }}>
        {TABS.map((t) => (<Button key={t.id} type="button" onClick={() => setTab(t.id)}
          style={{ fontSize: 13, padding: "6px 14px", borderRadius: 8, cursor: "pointer", border: "1px solid var(--color-border)", background: tab === t.id ? "var(--color-primary)" : "var(--color-bg)", color: tab === t.id ? "var(--color-primary-fg)" : "var(--color-fg)" }}>{t.label}</Button>))}
      </div>
      <Active />
    </main>
  );
}
