"use client";
/** 勤怠の統合デモ（打刻・集計・給与への受け渡しと、年次有給休暇）。 */
import * as React from "react";
import { UsesPackages } from "../../components/uses-packages";
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
          <UsesPackages
        packages={["attendance", "payroll"]}
        imports={{ attendance: ["createMemoryAttendanceStore", "grantsSinceHire", "leaveBalance"] }}
        snippet={`const store = createMemoryAttendanceStore({ start: "09:00", end: "18:00" });
await store.record("u1", { date: "2026-07-22", clockIn: "09:15", clockOut: "20:00", breakMinutes: 60 });
const month = await store.monthly("u1", "2026-07");   // そのまま calcMonthlyPay へ渡せる

// 有給: 入社日から法定の付与を出し、古い分から消化する
const grants = grantsSinceHire("2024-04-01", today);
const balance = leaveBalance(grants, taken, today);`}
      />
    </main>
  );
}
