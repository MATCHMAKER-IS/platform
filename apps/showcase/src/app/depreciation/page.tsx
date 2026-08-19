"use client";
import * as React from "react";
import { UsesPackages } from "../../components/uses-packages";
import { Button } from "@platform/ui";
import { DepreciationDemo } from "./dep-demo";
import { SequenceDemo } from "./seq-demo";
const TABS = [{ id: "a", label: "減価償却", Comp: DepreciationDemo }, { id: "b", label: "採番", Comp: SequenceDemo }] as const;
export default function Page() {
  const [tab, setTab] = React.useState<string>("a");
  const Active = (TABS.find((t) => t.id === tab) ?? TABS[0]).Comp;
  return (
    <main style={{ maxWidth: 1000, margin: "2rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 12 }}>経理ユーティリティ（減価償却・採番）</h1>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12, borderBottom: "1px solid var(--color-border)", paddingBottom: 10 }}>
        {TABS.map((t) => (<Button key={t.id} type="button" onClick={() => setTab(t.id)}
          style={{ fontSize: 13, padding: "6px 14px", borderRadius: 8, cursor: "pointer", border: "1px solid var(--color-border)", background: tab === t.id ? "var(--color-primary)" : "var(--color-bg)", color: tab === t.id ? "var(--color-primary-fg)" : "var(--color-fg)" }}>{t.label}</Button>))}
      </div>
      <Active />
          <UsesPackages
        packages={["depreciation", "tax"]}
        imports={{ depreciation: ["depreciationSchedule", "bookValueAt"] }}
        snippet={`// 定額法・定率法の年次表を出す。端数の扱いは法令に合わせてある
const schedule = depreciationSchedule({
  cost: 1_200_000, usefulLife: 5, method: "straight-line", startDate: "2026-04-01",
});
const value = bookValueAt(schedule, "2028-03-31");   // 期末の簿価`}
      />
    </main>
  );
}
