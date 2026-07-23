"use client";
/** 監査ログのデモ: 差分抽出・redact・ハッシュチェーン・絞り込み。 */
import * as React from "react";
import { Button } from "@platform/ui";
import {
  diffChanges,
  describeEvent,
  appendEvent,
  verifyChain,
  filterByActor,
  filterByAction,
  historyOf,
  type AuditEvent,
  type AuditEntry,
} from "@platform/audit";

const EVENTS: AuditEvent[] = [
  {
    at: "2026-07-15T09:12:00Z",
    actor: "u-yamada",
    action: "expense.submit",
    target: "expense:1042",
    before: { amount: 0, status: "draft", note: "", ssn: "123-45-6789" },
    after: { amount: 12800, status: "submitted", note: "出張交通費", ssn: "123-45-6789" },
  },
  {
    at: "2026-07-15T14:30:00Z",
    actor: "u-suzuki",
    action: "expense.approve",
    target: "expense:1042",
    before: { status: "submitted", approver: null, updatedAt: "2026-07-15T09:12:00Z" },
    after: { status: "approved", approver: "u-suzuki", updatedAt: "2026-07-15T14:30:00Z" },
  },
  {
    at: "2026-07-16T10:05:00Z",
    actor: "u-yamada",
    action: "invoice.issue",
    target: "invoice:INV-00042",
    before: { status: "draft", total: 0 },
    after: { status: "issued", total: 2398000 },
  },
  {
    at: "2026-07-16T11:20:00Z",
    actor: "u-admin",
    action: "expense.reject",
    target: "expense:1043",
    before: { status: "submitted", reason: "" },
    after: { status: "rejected", reason: "領収書が添付されていません" },
  },
];

const box: React.CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius)",
  background: "var(--color-surface)",
  padding: 16,
  marginBottom: 16,
};

const mono: React.CSSProperties = { fontFamily: "monospace", fontSize: 12 };

function buildLog(): AuditEntry[] {
  let log: AuditEntry[] = [];
  for (const e of EVENTS) log = appendEvent(log, e);
  return log;
}

const show = (v: unknown) => (v === null || v === undefined || v === "" ? "（空）" : String(v));

export function AuditDemo() {
  const [log, setLog] = React.useState<AuditEntry[]>(() => buildLog());
  const [actor, setActor] = React.useState("");
  const [action, setAction] = React.useState("");
  const [target, setTarget] = React.useState("");

  const verification = React.useMemo(() => verifyChain(log), [log]);

  let filtered = log;
  if (actor !== "") filtered = filterByActor(filtered, actor);
  if (action !== "") filtered = filterByAction(filtered, action);
  if (target !== "") filtered = historyOf(filtered, target);

  function tamper(seq: number) {
    setLog((prev) =>
      prev.map((e) => (e.seq === seq ? { ...e, actor: "u-attacker" } : e)),
    );
  }

  const actors = [...new Set(EVENTS.map((e) => e.actor))];
  const actions = [...new Set(EVENTS.map((e) => e.action))];
  const targets = [...new Set(EVENTS.map((e) => e.target))];

  return (
    <>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 4 }}>監査ログ</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted)", lineHeight: 1.8, marginBottom: 20 }}>
        「誰が・いつ・何を・どう変えたか」を残します。<strong>変更前後から差分を自動で抽出</strong>し、
        <strong>ハッシュチェーンで後からの書き換えを検知</strong>します。
        監査ログは<strong>それ自体が改ざんされたら意味がない</strong>ので、この仕組みが要ります。
      </p>

      <div style={box}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>① 改ざん検知</h2>
          <Button
            onClick={() => setLog(buildLog())}
            style={{ padding: "5px 14px", borderRadius: "var(--radius)", border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-fg)", cursor: "pointer", fontSize: 12 }}
          >
            ログを作り直す
          </Button>
        </div>
        <div
          style={{
            padding: "8px 12px",
            borderRadius: "var(--radius)",
            fontSize: 13,
            fontWeight: 700,
            color: verification.valid ? "var(--color-success)" : "var(--color-danger)",
            border: `1px solid ${verification.valid ? "var(--color-success)" : "var(--color-danger)"}`,
          }}
        >
          {verification.valid
            ? "○ ログは改ざんされていません"
            : `× 改ざんを検知 — seq ${verification.brokenAt} 以降が壊れています`}
        </div>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 8 }}>
          下の表の「操作者を書き換え」を押すと、<strong>そのレコードの actor が u-attacker に変わり</strong>、
          チェーンが壊れます。「自分の操作を他人のせいにする」という一番ありそうな改ざんです。
        </p>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>② 絞り込み</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          <select value={actor} onChange={(e) => setActor(e.target.value)} style={{ padding: "5px 8px", borderRadius: 4, border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-fg)", fontSize: 12 }}>
            <option value="">操作者: すべて</option>
            {actors.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <select value={action} onChange={(e) => setAction(e.target.value)} style={{ padding: "5px 8px", borderRadius: 4, border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-fg)", fontSize: 12 }}>
            <option value="">操作: すべて</option>
            {actions.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <select value={target} onChange={(e) => setTarget(e.target.value)} style={{ padding: "5px 8px", borderRadius: 4, border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-fg)", fontSize: 12 }}>
            <option value="">対象: すべて</option>
            {targets.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <span style={{ fontSize: 12, color: "var(--color-muted)", alignSelf: "center" }}>
            {log.length} 件中 {filtered.length} 件
          </span>
        </div>
        <p style={{ fontSize: 12, color: "var(--color-muted)" }}>
          「対象」で <code>expense:1042</code> を選ぶと、その 1 件の履歴だけが時系列で出ます（<code>historyOf()</code>）。
          監査でいちばん聞かれる「この申請、誰が何をしたの？」がこれです。
        </p>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>③ ログ</h2>
        {filtered.map((e) => {
          // @platform/audit の brokenAt は `number | null`(dencho の同名型は `number | undefined`)。
          // valid で分岐すれば、どちらの表現でも安全に絞り込める。
          const broken = !verification.valid && verification.brokenAt !== null && e.seq >= verification.brokenAt;
          // ssn は伏せる。updatedAt は差分として意味がないので無視する。
          const changes = diffChanges(e.before as Record<string, unknown>, e.after as Record<string, unknown>, {
            ignore: ["updatedAt"],
            redact: ["ssn"],
          });
          return (
            <div
              key={e.seq}
              style={{
                borderTop: "1px solid var(--color-border)",
                padding: "12px 0",
                background: broken ? "color-mix(in srgb, var(--color-danger) 8%, transparent)" : "transparent",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{describeEvent(e)}</div>
                  <div style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 2 }}>
                    seq {e.seq} / {e.at} / hash <span style={mono}>{e.hash}</span>
                  </div>
                </div>
                <Button
                  onClick={() => tamper(e.seq)}
                  style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, border: "1px solid var(--color-danger)", background: "transparent", color: "var(--color-danger)", cursor: "pointer", whiteSpace: "nowrap" }}
                >
                  操作者を書き換え
                </Button>
              </div>

              {changes.length > 0 && (
                <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse", marginTop: 8 }}>
                  <tbody>
                    {changes.map((c) => (
                      <tr key={c.field}>
                        <td style={{ padding: "2px 8px 2px 0", color: "var(--color-muted)", width: 100 }}>{c.field}</td>
                        <td style={{ padding: "2px 8px 2px 0", ...mono, color: "var(--color-muted)" }}>{show(c.before)}</td>
                        <td style={{ padding: "2px 8px 2px 0", color: "var(--color-muted)" }}>→</td>
                        <td style={{ padding: "2px 0", ...mono, fontWeight: 700 }}>{show(c.after)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          );
        })}
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 12, lineHeight: 1.8 }}>
          差分は <code>diffChanges(before, after, {"{"} ignore: [&quot;updatedAt&quot;], redact: [&quot;ssn&quot;] {"}"})</code> で出しています。
          <br />
          <strong>1 件目に <code>ssn</code> が出てこないことを確認してください</strong> — 値が同じなので差分に現れませんが、
          仮に変わっても <code>redact</code> で伏せられます。<strong>監査ログに個人情報を書かない</strong>ための仕組みです。
          <br />
          <code>updatedAt</code> は「変わって当たり前」なので <code>ignore</code> しています。これが無いと、
          全レコードに毎回 updatedAt の差分が出て、本当に見たい変更が埋もれます。
        </p>
      </div>
    </>
  );
}
