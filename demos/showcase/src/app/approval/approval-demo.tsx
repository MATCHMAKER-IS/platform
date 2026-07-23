"use client";
/** 経費承認ワークフローのデモ(@platform/workflow)。課長→経理の2段承認。 */
import { useState } from "react";
import { startWorkflow, approve, reject, currentStep, notificationForTransition, type WorkflowState } from "@platform/workflow";
import { Button, Badge } from "@platform/ui";

const FLOW = { steps: [{ name: "課長承認", approverRole: "manager" }, { name: "経理承認", approverRole: "finance" }] };
const ACTORS = {
  manager: { id: "m1", roles: ["manager"], label: "課長(田中)" },
  finance: { id: "f1", roles: ["finance"], label: "経理(佐藤)" },
};

export function ApprovalDemo() {
  const [state, setState] = useState<WorkflowState>(() => startWorkflow(FLOW));
  const [msg, setMsg] = useState("");
  const [notice, setNotice] = useState("");
  const step = currentStep(FLOW, state);

  const act = (who: keyof typeof ACTORS, kind: "approve" | "reject") => () => {
    const actor = ACTORS[who];
    const res = kind === "approve" ? approve(FLOW, state, actor) : reject(FLOW, state, actor, "内容に不備があるため差し戻し");
    if (res.ok) {
      // workflow × notify: 状態遷移に応じて通知(実運用は notifier.notify に送る)
      const n = notificationForTransition(state, res.value, { title: "経費申請 消耗品費 ¥842" });
      if (n) setNotice(`[${n.level}] ${n.text}`);
      setState(res.value); setMsg("");
    } else setMsg(res.error.message);
  };

  return (
    <>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>経費承認ワークフロー</h1>
      <p style={{ color: "var(--color-muted)", margin: ".5rem 0 1rem", fontSize: ".9rem" }}>
        経費「消耗品費 ¥842」を 課長 → 経理 の2段で承認します。権限が合わないと却下されます。
      </p>

      <div style={{ display: "flex", alignItems: "center", gap: ".5rem", marginBottom: "1rem" }}>
        状態:
        <Badge variant={state.status === "approved" ? "success" : state.status === "rejected" ? "danger" : "warning"}>
          {state.status === "pending" ? `承認待ち(${step?.name})` : state.status === "approved" ? "承認完了" : "却下"}
        </Badge>
      </div>

      {state.status === "pending" && (
        <div style={{ display: "grid", gap: ".5rem", marginBottom: "1rem" }}>
          <div style={{ fontSize: ".85rem", color: "var(--color-muted)" }}>操作する担当者:</div>
          <div style={{ display: "flex", gap: ".5rem", flexWrap: "wrap" }}>
            <Button onClick={act("manager", "approve")}>課長として承認</Button>
            <Button onClick={act("finance", "approve")}>経理として承認</Button>
            <Button variant="secondary" onClick={act("manager", "reject")}>課長として却下</Button>
          </div>
        </div>
      )}
      {msg && <p style={{ color: "var(--color-danger)", fontSize: ".9rem" }}>{msg}</p>}
      {notice && <p style={{ color: "var(--color-primary)", fontSize: ".9rem", background: "var(--color-primary)/10", padding: ".5rem .75rem", borderRadius: "var(--radius)" }}>🔔 通知: {notice}</p>}

      <h2 style={{ fontWeight: 700, margin: "1rem 0 .5rem" }}>履歴</h2>
      {state.history.length === 0 ? <p style={{ color: "var(--color-muted)" }}>まだありません</p> : (
        <ul style={{ display: "grid", gap: ".25rem" }}>
          {state.history.map((h, i) => (
            <li key={i} style={{ fontSize: ".9rem" }}>
              {h.step}: <strong>{h.action === "approve" ? "承認" : "却下"}</strong>({h.actor}){h.reason ? ` — ${h.reason}` : ""}
            </li>
          ))}
        </ul>
      )}
      <p style={{ marginTop: "1.5rem" }}><a href="/">← 戻る</a></p>
    </>
  );
}
