"use client";
/** ステートマシンのデモ: 遷移表・許可されないイベント・履歴の再生・終了状態。 */
import * as React from "react";
import { Button } from "@platform/ui";
import {
  can,
  transition,
  availableEvents,
  isFinal,
  run,
  type StateMachineDefinition,
  type Transitions,
  type RunResult,
} from "@platform/fsm";

/** 経費申請の状態。`/expenses` `/approval` と同じ題材。 */
type S = "draft" | "submitted" | "approved" | "rejected" | "paid" | "cancelled";
/** 起きうる操作。 */
type E = "submit" | "approve" | "reject" | "pay" | "withdraw" | "cancel";

const STATE_LABEL: Record<S, string> = {
  draft: "下書き",
  submitted: "申請中",
  approved: "承認済",
  rejected: "差戻し",
  paid: "支払済",
  cancelled: "取消",
};

const EVENT_LABEL: Record<E, string> = {
  submit: "申請する",
  approve: "承認する",
  reject: "差し戻す",
  pay: "支払う",
  withdraw: "取り下げる",
  cancel: "取り消す",
};

const STATE_COLOR: Record<S, string> = {
  draft: "var(--color-muted)",
  submitted: "var(--color-primary)",
  approved: "var(--color-success)",
  rejected: "var(--color-danger)",
  paid: "var(--color-success)",
  cancelled: "var(--color-muted)",
};

const TRANSITIONS: Transitions<S, E> = {
  draft: { submit: "submitted", cancel: "cancelled" },
  submitted: { approve: "approved", reject: "rejected", withdraw: "draft" },
  approved: { pay: "paid" },
  rejected: { withdraw: "draft", cancel: "cancelled" },
};

const DEF: StateMachineDefinition<S, E> = {
  initial: "draft",
  transitions: TRANSITIONS,
  final: ["paid", "cancelled"],
};

const ALL_STATES: S[] = ["draft", "submitted", "approved", "rejected", "paid", "cancelled"];
const ALL_EVENTS: E[] = ["submit", "approve", "reject", "pay", "withdraw", "cancel"];

/** 履歴の再生に使うシナリオ。 */
const SCENARIOS: { label: string; events: E[] }[] = [
  { label: "順調に支払まで", events: ["submit", "approve", "pay"] },
  { label: "差戻し → 再申請 → 承認", events: ["submit", "reject", "withdraw", "submit", "approve", "pay"] },
  { label: "★承認前に支払おうとする", events: ["submit", "pay"] },
  { label: "★支払済からさらに操作", events: ["submit", "approve", "pay", "withdraw"] },
];

const box: React.CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius)",
  background: "var(--color-surface)",
  padding: 16,
  marginBottom: 16,
};

const mono: React.CSSProperties = { fontFamily: "monospace", fontSize: 12 };

export default function Page() {
  const [state, setState] = React.useState<S>(DEF.initial);
  const [history, setHistory] = React.useState<{ event: E; from: S; to: S }[]>([]);
  const [rejected, setRejected] = React.useState<{ event: E; at: S } | null>(null);
  const [replay, setReplay] = React.useState<RunResult<S, E> | null>(null);

  function fire(event: E) {
    const next = transition(DEF, state, event);
    if (next === null) {
      setRejected({ event, at: state });
      return;
    }
    setRejected(null);
    setHistory((prev) => [...prev, { event, from: state, to: next }]);
    setState(next);
  }

  function reset() {
    setState(DEF.initial);
    setHistory([]);
    setRejected(null);
  }

  const next = availableEvents(DEF, state);
  const final = isFinal(DEF, state);

  return (
    <main style={{ maxWidth: 900, margin: "2.5rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 4 }}>ステートマシン</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted)", lineHeight: 1.8, marginBottom: 20 }}>
        「承認前なのに支払える」「支払済なのに取り下げられる」——
        <strong>状態を <code>if</code> で判定していると、必ずどこかに穴が空きます</strong>。
        <strong>遷移表に無い操作は、そもそも通らない</strong>のが <code>@platform/fsm</code> です。
        UI で隠すのではなく、<strong>ロジックが拒否します</strong>。
      </p>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>① 動かす</h2>

        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
          <span style={{ fontSize: 12, color: "var(--color-muted)" }}>現在</span>
          <span
            style={{
              fontSize: 15,
              fontWeight: 700,
              padding: "5px 16px",
              borderRadius: 999,
              color: STATE_COLOR[state],
              border: `2px solid ${STATE_COLOR[state]}`,
            }}
          >
            {STATE_LABEL[state]}
          </span>
          {final && <span style={{ fontSize: 12, color: "var(--color-muted)" }}>終了状態（これ以上進みません）</span>}
          <Button size="sm" variant="secondary" onClick={reset} style={{ marginLeft: "auto" }}>
            最初から
          </Button>
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {ALL_EVENTS.map((e) => {
            const ok = can(DEF, state, e);
            return (
              <Button key={e} size="sm" variant={ok ? "primary" : "secondary"} onClick={() => fire(e)}>
                {EVENT_LABEL[e]}
                {!ok && <span style={{ marginLeft: 4, opacity: 0.6 }}>×</span>}
              </Button>
            );
          })}
        </div>

        {rejected !== null && (
          <div
            style={{
              padding: "8px 12px",
              borderRadius: "var(--radius)",
              border: "1px solid var(--color-danger)",
              color: "var(--color-danger)",
              fontSize: 13,
              marginBottom: 10,
            }}
          >
            <b>{STATE_LABEL[rejected.at]}</b> の状態で <b>{EVENT_LABEL[rejected.event]}</b> はできません
            （<code>transition()</code> が <code>null</code> を返しました）
          </div>
        )}

        <p style={{ fontSize: 12, color: "var(--color-muted)", lineHeight: 1.8 }}>
          <strong>× の付いたボタンも押せます。</strong>押すと拒否されるのを見てほしいからです。
          実際のアプリでは <code>availableEvents()</code> でボタン自体を出し分けますが、
          <strong>API を直接叩かれても同じように拒否されます</strong>。そこが「UI で隠す」との違いです。
          <br />
          いま押せるのは: {next.length > 0 ? next.map((e) => EVENT_LABEL[e]).join(" / ") : "なし（終了状態）"}
        </p>
      </div>

      {history.length > 0 && (
        <div style={box}>
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>履歴</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "var(--color-muted)" }}>{STATE_LABEL[DEF.initial]}</span>
            {history.map((h, i) => (
              <React.Fragment key={i}>
                <span style={{ fontSize: 11, color: "var(--color-primary)" }}>—{EVENT_LABEL[h.event]}→</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: STATE_COLOR[h.to] }}>{STATE_LABEL[h.to]}</span>
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>② 遷移表</h2>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 10 }}>
          <strong>これが仕様そのもの</strong>です。表に無いものは起きません。
          レビューで「この操作、ここでできるんだっけ？」と聞かれたら、この表を見せれば終わります。
        </p>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse", minWidth: 560 }}>
            <thead>
              <tr style={{ color: "var(--color-muted)" }}>
                <th style={{ padding: 5, textAlign: "left" }}>状態＼操作</th>
                {ALL_EVENTS.map((e) => (
                  <th key={e} style={{ padding: 5, fontWeight: 400 }}>
                    {EVENT_LABEL[e]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ALL_STATES.map((s) => (
                <tr key={s} style={{ borderTop: "1px solid var(--color-border)", background: s === state ? "color-mix(in srgb, var(--color-primary) 8%, transparent)" : "transparent" }}>
                  <td style={{ padding: 5, fontWeight: 700, color: STATE_COLOR[s], whiteSpace: "nowrap" }}>
                    {STATE_LABEL[s]}
                    {isFinal(DEF, s) && <span style={{ fontSize: 10, color: "var(--color-muted)", marginLeft: 4 }}>終了</span>}
                  </td>
                  {ALL_EVENTS.map((e) => {
                    const to = transition(DEF, s, e);
                    return (
                      <td key={e} style={{ padding: 5, textAlign: "center", color: to === null ? "var(--color-border)" : "var(--color-fg)" }}>
                        {to === null ? "—" : STATE_LABEL[to]}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>③ 履歴をまとめて再生（run）</h2>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 10, lineHeight: 1.8 }}>
          イベントの列を渡すと、<strong>最後まで進むか、弾かれた所で止まります</strong>。
          監査ログから状態を復元したり、<strong>「この操作列は成立するか」をテストで確かめる</strong>のに使います。
        </p>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          {SCENARIOS.map((sc) => (
            <Button key={sc.label} size="sm" variant="secondary" onClick={() => setReplay(run(DEF, sc.events))}>
              {sc.label}
            </Button>
          ))}
        </div>
        {replay !== null && (
          <div style={{ ...mono, background: "var(--color-bg)", padding: 12, borderRadius: "var(--radius)", lineHeight: 1.9 }}>
            <div>
              最終状態: <b style={{ color: STATE_COLOR[replay.state] }}>{STATE_LABEL[replay.state]}</b>
            </div>
            <div style={{ color: "var(--color-muted)" }}>
              適用: {replay.applied.length > 0 ? replay.applied.map((e) => EVENT_LABEL[e]).join(" → ") : "なし"}
            </div>
            <div style={{ color: replay.rejected === null ? "var(--color-success)" : "var(--color-danger)" }}>
              {replay.rejected === null
                ? "○ 全部適用できました"
                : `× 「${EVENT_LABEL[replay.rejected]}」で止まりました（${STATE_LABEL[replay.state]} からはできない）`}
            </div>
          </div>
        )}
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10, lineHeight: 1.8 }}>
          ★ の付いたシナリオが<strong>止まる</strong>のを見てください。
          <strong>「承認前に支払う」も「支払済から取り下げる」も、コードを読まずに防げます</strong>。
          <br />
          関連: <a href="/approval" style={{ color: "var(--color-primary)" }}>承認ワークフロー</a> は
          <code>@platform/workflow</code>（多段承認・代理承認）、こちらは<strong>状態遷移そのもの</strong>です。
        </p>
      </div>
    </main>
  );
}
