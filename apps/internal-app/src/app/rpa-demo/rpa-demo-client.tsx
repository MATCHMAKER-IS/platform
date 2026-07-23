"use client";
/** RPA 安全実行のデモ。ランナー経由(直列化・リトライ・タイムアウト・監査)でサンプルタスクを実行し、監査ログを表示。 */
import * as React from "react";
import { Button } from "@platform/ui";

interface RunResult { ok: boolean; runId: string; attempts: number; error?: string; }
interface AuditEvent { action: string; target?: string; at: string; metadata?: Record<string, unknown>; }

export function RpaDemoClient({ fetchImpl }: { fetchImpl?: typeof fetch }) {
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;
  const [result, setResult] = React.useState<RunResult | null>(null);
  const [events, setEvents] = React.useState<AuditEvent[]>([]);
  const [busy, setBusy] = React.useState(false);

  const loadLog = async () => {
    const r = await doFetch("/api/rpa/log");
    if (r.ok) { const d = await r.json(); setEvents(d.events as AuditEvent[]); }
  };
  const run = async (fail: boolean) => {
    setBusy(true); setResult(null);
    try {
      const r = await doFetch("/api/rpa/run", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ steps: 3, fail }) });
      setResult(await r.json() as RunResult);
      await loadLog();
    } finally { setBusy(false); }
  };
  React.useEffect(() => { void loadLog(); }, []);

  const card: React.CSSProperties = { background: "var(--color-surface, #fff)", border: "1px solid #e8e8e8", borderRadius: 10, padding: 16 };

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 22 }}>RPA デモ（安全実行）</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted, #666)", lineHeight: 1.6 }}>RPA ランナー経由でサンプルタスクを実行します。同じ <code>lockKey</code> のタスクは直列化され、失敗時はリトライ、全操作は監査に記録されます（基盤は RPA 本体を持たず、安全に回す枠組みだけを提供します）。</p>
      <div style={{ ...card, marginTop: 12, display: "flex", gap: 8 }}>
        <Button onClick={() => run(false)} disabled={busy} style={{ padding: "8px 20px", background: busy ? "#ccc" : "var(--color-primary, #2563eb)", color: "var(--color-surface, #fff)", border: "none", borderRadius: 8 }}>{busy ? "実行中…" : "成功パターンを実行"}</Button>
        <Button onClick={() => run(true)} disabled={busy} style={{ padding: "8px 20px", background: "var(--color-surface, #fff)", color: "var(--color-danger, #c00)", border: "1px solid #f0c0c0", borderRadius: 8 }}>失敗パターンを実行（リトライ確認）</Button>
      </div>
      {result && (
        <div style={{ ...card, marginTop: 12, background: result.ok ? "#f0fdf4" : "#fef2f2" }}>
          <div style={{ fontSize: 14 }}>{result.ok ? `✓ 成功（runId ${result.runId} / ${result.attempts} 回試行）` : `✗ 失敗: ${result.error}`}</div>
        </div>
      )}
      <div style={{ ...card, marginTop: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>監査ログ（直近）</div>
        {events.length === 0 && <p style={{ fontSize: 13, color: "var(--color-muted, #999)" }}>まだありません。</p>}
        {events.map((e, i) => (
          <div key={i} style={{ fontSize: 12, padding: "4px 0", borderBottom: "1px solid #f5f5f5", display: "flex", gap: 8 }}>
            <span style={{ color: "var(--color-muted, #999)", minWidth: 140 }}>{e.at.replace("T", " ").slice(0, 19)}</span>
            <code style={{ color: e.action.includes("error") ? "var(--color-danger, #c00)" : e.action.includes("success") ? "var(--color-success, #16a34a)" : "#333" }}>{e.action}</code>
            {e.metadata?.attempt ? <span style={{ color: "var(--color-muted, #888)" }}>試行{String(e.metadata.attempt)}</span> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
