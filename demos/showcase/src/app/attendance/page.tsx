"use client";
/** 勤怠の統合デモ（打刻・集計・給与への受け渡しと、年次有給休暇）。 */
import * as React from "react";
import { Button } from "@platform/ui";
import { TimecardDemo } from "./timecard-demo";
import { LeaveDemo } from "./leave-demo";

const TABS = [
  { id: "a", label: "打刻・月次集計", Comp: TimecardDemo },
  { id: "b", label: "年次有給休暇", Comp: LeaveDemo },
] as const;

export default function Page() {
  const [tab, setTab] = React.useState<(typeof TABS)[number]["id"]>("a");
  const Current = TABS.find((t) => t.id === tab)!.Comp;
  return (
    <main style={{ maxWidth: 900, margin: "2.5rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 6 }}>勤怠・有給</h1>
      <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
        {TABS.map((t) => (
          <Button key={t.id} size="sm" variant={tab === t.id ? "primary" : "secondary"} onClick={() => setTab(t.id)}>{t.label}</Button>
        ))}
      </div>
      <Current />
    </main>
  );
}
