"use client";
/** 経費承認画面。ロールを切り替えて 承認/却下/差戻し を体験できるデモ。 */
import { useState, type ChangeEvent } from "react";
import { Button, Badge } from "@platform/ui";
import { formatNumber } from "@platform/utils";
import { submitExpense, statusLabel, availableActions, actOn, type ExpenseRequest } from "../../../lib/expense-approval.js";
import type { Actor } from "@platform/workflow";

const yen = (n: number) => `¥${formatNumber(n, {})}`;

const ROLES: Record<string, Actor> = {
  "申請者(staff)": { id: "s1", roles: ["staff"] },
  "課長(manager)": { id: "m1", roles: ["manager"] },
  "部長(director)": { id: "d1", roles: ["director"] },
};

const ACTION_LABEL: Record<string, string> = { approve: "承認", reject: "却下", sendback: "差戻し" };

export default function ApprovalPage() {
  const [req, setReq] = useState<ExpenseRequest>(() =>
    submitExpense("req-1", "山田太郎", { id: "e1", date: "2024-04-30", category: "外注費", amount: 180000, note: "スポット依頼" }),
  );
  const [role, setRole] = useState<string>("課長(manager)");
  const [error, setError] = useState<string | null>(null);
  const actor = ROLES[role]!;
  const actions = availableActions(req.state, actor);

  const doAction = (action: "approve" | "reject" | "sendback") => {
    const reason = action !== "approve" ? window.prompt(`${ACTION_LABEL[action]}の理由`) ?? "" : undefined;
    const res = actOn(req, actor, action, reason);
    setError(res.error ?? null);
    setReq(res.request);
  };

  const badgeTone = req.state.status === "approved" ? "success" : req.state.status === "rejected" ? "danger" : "default";

  return (
    <main style={{ maxWidth: 720, margin: "2rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "1rem" }}>経費承認</h1>

      <div style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: "1rem", marginBottom: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div><b>{req.expense.category}</b> {yen(req.expense.amount)} <span style={{ color: "var(--color-muted)" }}>/ 申請: {req.applicant}</span></div>
          <Badge tone={badgeTone as never}>{statusLabel(req.state)}</Badge>
        </div>
        {req.expense.note && <div style={{ color: "var(--color-muted)", fontSize: ".9rem", marginTop: ".25rem" }}>{req.expense.note}</div>}
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <label style={{ marginRight: ".5rem", color: "var(--color-muted)" }}>操作ロール:</label>
        <select value={role} onChange={(e: ChangeEvent<HTMLSelectElement>) => { setRole(e.target.value); setError(null); }} style={{ padding: ".25rem .5rem", border: "1px solid var(--color-border)", borderRadius: 6 }}>
          {Object.keys(ROLES).map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      {actions.length > 0 ? (
        <div style={{ display: "flex", gap: ".5rem" }}>
          {actions.map((a) => (
            <Button key={a} variant={a === "approve" ? "primary" : "secondary"} onClick={() => doAction(a)}>{ACTION_LABEL[a]}</Button>
          ))}
        </div>
      ) : (
        <p style={{ color: "var(--color-muted)" }}>{req.state.status === "pending" ? "このロールでは操作できません(現在: " + statusLabel(req.state) + ")" : "完了しました。"}</p>
      )}

      {error && <p style={{ color: "var(--color-danger)", marginTop: ".5rem" }}>{error}</p>}

      <section style={{ marginTop: "1.5rem" }}>
        <h2 style={{ fontWeight: 700, marginBottom: ".5rem" }}>履歴</h2>
        {req.state.history.length === 0 ? <p style={{ color: "var(--color-muted)" }}>まだありません。</p> : (
          <ol style={{ fontSize: ".9rem", lineHeight: 1.9 }}>
            {req.state.history.map((h, i) => (
              <li key={i}>{h.step}: <b>{ACTION_LABEL[h.action]}</b>({h.actor}){h.reason ? ` — ${h.reason}` : ""}</li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}
