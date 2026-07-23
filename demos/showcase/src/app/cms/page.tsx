"use client";
/** 記事管理・多言語の統合デモ（タブでまとめたもの）。 */
import * as React from "react";
import { Button } from "@platform/ui";
import { CmsDemo } from "./cms-demo";
import { I18nDemo } from "./i18n-demo";
const TABS = [{ id: "a", label: "記事管理(CMS)", Comp: CmsDemo }, { id: "b", label: "多言語(i18n)", Comp: I18nDemo }] as const;
export default function Page() {
  const [tab, setTab] = React.useState<string>("a");
  const Active = (TABS.find((t) => t.id === tab) ?? TABS[0]).Comp;
  return (
    <main style={{ maxWidth: 1000, margin: "2rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 12 }}>記事管理・多言語</h1>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12, borderBottom: "1px solid var(--color-border)", paddingBottom: 10 }}>
        {TABS.map((t) => (<Button key={t.id} type="button" onClick={() => setTab(t.id)}
          style={{ fontSize: 13, padding: "6px 14px", borderRadius: 8, cursor: "pointer", border: "1px solid var(--color-border)", background: tab === t.id ? "var(--color-primary)" : "var(--color-bg)", color: tab === t.id ? "var(--color-primary-fg)" : "var(--color-fg)" }}>{t.label}</Button>))}
      </div>
      <Active />
    </main>
  );
}
