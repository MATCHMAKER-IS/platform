"use client";
/** RPA ランナーのデモ。実行すると直列化・リトライ・冪等・監査の挙動が監査イベントに出る。 */
import * as React from "react";
import { Button } from "@platform/ui";

interface Ev { action: string; target?: string; at: string; metadata?: Record<string, unknown>; }

export function RpaDemoClient({ fetchImpl }: { fetchImpl?: typeof fetch }) {
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;
  const [events, setEvents] = React.useState<Ev[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState("");

  const load = async () => {
    const r = await doFetch("/api/rpa/demo");
    const d = await r.json();
    if (r.ok) setEvents(d.events as Ev[]);
  };
  React.useEffect(() => { void load(); }, []);

  const run = async (opts: { fail?: boolean; idempotencyKey?: string }) => {
    setBusy(true); setMsg("");
    try {
      const r = await doFetch("/api/rpa/demo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(opts) });
      const d = await r.json();
      setMsg(d.result ? `成功: ${d.result.rows} 行取得` : `${d.code}: ${d.error}`);
      await load();
    } finally { setBusy(false); }
  };

  const card: React.CSSProperties = { background: "var(--color-surface, #fff)", border: "1px solid #e8e8e8", borderRadius: 10, padding: 16 };
  const btn: React.CSSProperties = { padding: "8px 16px", borderRadius: 8, border: "1px solid #ddd", background: "var(--color-surface, #fff)", cursor: "pointer" };

  return (
    <div style={{ maxWidth: 820, margin: "0 auto", padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 22 }}>RPA ランナー（デモ）</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted, #666)", lineHeight: 1.6 }}>基盤は RPA 本体を持ちません（API {">"} MCP {">"} RPA）。ここでは「安全に実行する枠組み」——直列化・リトライ・冪等・タイムアウト・監査——の挙動を確認できます。</p>
      <div style={{ ...card, marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Button onClick={() => run({})} disabled={busy} style={btn}>通常実行</Button>
        <Button onClick={() => run({ fail: true })} disabled={busy} style={btn}>1回失敗させる（リトライ確認）</Button>
        <Button onClick={() => run({ idempotencyKey: "daily-demo" })} disabled={busy} style={btn}>冪等キー付き実行（2回目はskip）</Button>
      </div>
      {msg && <p style={{ fontSize: 13, marginTop: 8, color: msg.startsWith("成功") ? "var(--color-success, #16a34a)" : "var(--color-warning, #b45309)" }}>{msg}</p>}
      <div style={{ ...card, marginTop: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>監査イベント（新しい順）</div>
        {events.length === 0 && <p style={{ fontSize: 13, color: "var(--color-muted, #999)" }}>まだイベントがありません。上のボタンで実行してください。</p>}
        {events.map((e, i) => (
          <div key={i} style={{ fontSize: 12, padding: "4px 0", borderBottom: "1px solid #f5f5f5", display: "flex", gap: 8 }}>
            <code style={{ color: e.action.startsWith("rpa.error") ? "var(--color-danger, #c00)" : e.action.startsWith("rpa.success") ? "var(--color-success, #16a34a)" : "#4338ca", minWidth: 120 }}>{e.action}</code>
            <span style={{ color: "var(--color-muted, #999)", fontSize: 11 }}>{e.metadata ? JSON.stringify(e.metadata) : ""}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
