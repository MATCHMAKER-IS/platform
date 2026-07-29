"use client";
import * as React from "react";
import { UsesPackages } from "../../components/uses-packages";
import { Button } from "@platform/ui";
import { AuditDemo } from "./audit-demo";
import { GuardDemo } from "./guard-demo";
const TABS = [{ id: "a", label: "監査ログ", Comp: AuditDemo }, { id: "b", label: "ルートガード", Comp: GuardDemo }] as const;
export default function Page() {
  const [tab, setTab] = React.useState<string>("a");
  const Active = (TABS.find((t) => t.id === tab) ?? TABS[0]).Comp;
  return (
    <main style={{ maxWidth: 1000, margin: "2rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 12 }}>監査・ガード</h1>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12, borderBottom: "1px solid var(--color-border)", paddingBottom: 10 }}>
        {TABS.map((t) => (<Button key={t.id} type="button" onClick={() => setTab(t.id)}
          style={{ fontSize: 13, padding: "6px 14px", borderRadius: 8, cursor: "pointer", border: "1px solid var(--color-border)", background: tab === t.id ? "var(--color-primary)" : "var(--color-bg)", color: tab === t.id ? "var(--color-primary-fg)" : "var(--color-fg)" }}>{t.label}</Button>))}
      </div>
      <Active />
          <UsesPackages
        packages={["audit"]}
        imports={{ audit: ["appendEvent", "diffChanges"] }}
        snippet={`// 誰が・いつ・何を変えたかを残す。参照は記録しない(量が増えるだけ)
appendEvent(store, {
  at: new Date().toISOString(), actor: user.id,
  action: "invoice.update", target: \`invoice:\${id}\`,
  before: prev, after: next,
});`}
      />
    </main>
  );
}
