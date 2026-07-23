"use client";
/** RPA 安全実行のデモ。直列化・リトライ・冪等・監査を体感できる。実処理はサンプル(擬似ポイント同期)。 */
import * as React from "react";
import { Button, Checkbox, Input } from "@platform/ui";

interface RunResult { rows: number; attempts: number; skipped: boolean; }
interface AuditEvent { action: string; target?: string; at: string; metadata?: Record<string, unknown>; }

export function RpaClient({ fetchImpl }: { fetchImpl?: typeof fetch }) {
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<RunResult | null>(null);
  const [error, setError] = React.useState("");
  const [events, setEvents] = React.useState<AuditEvent[]>([]);
  const [fail, setFail] = React.useState(false);
  const [idempotencyKey, setIdempotencyKey] = React.useState("");

  const loadEvents = async () => {
    const r = await doFetch("/api/rpa/demo");
    if (r.ok) { const d = await r.json(); setEvents((d as { events: AuditEvent[] }).events); }
  };
  const run = async () => {
    setBusy(true); setResult(null); setError("");
    try {
      const r = await doFetch("/api/rpa/demo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ fail, ...(idempotencyKey ? { idempotencyKey } : {}) }) });
      const d = await r.json();
      if ((d as { result?: RunResult }).result) setResult((d as { result: RunResult }).result);
      else setError((d as { error?: string }).error ?? "実行に失敗しました");
      await loadEvents();
    } finally { setBusy(false); }
  };

  React.useEffect(() => { void loadEvents(); }, []);

  const card: React.CSSProperties = { background: "var(--color-surface, #fff)", border: "1px solid #e8e8e8", borderRadius: 10, padding: 16 };
  const actionColor = (a: string): string => a.includes("success") ? "var(--color-success, #16a34a)" : a.includes("error") || a.includes("timeout") ? "var(--color-danger, #dc2626)" : a.includes("start") ? "var(--color-primary, #2563eb)" : "var(--color-muted, #666)";

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 22 }}>RPA 実行（デモ）</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted, #666)", lineHeight: 1.6 }}>基盤は RPA 本体を持たず、「安全に実行する枠組み」（直列化・リトライ・冪等・タイムアウト・監査）だけを提供します。下のボタンでサンプルタスクを実行すると、監査ログに各ステップが記録されます。</p>

      <div style={{ ...card, marginTop: 12 }}>
        <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <Checkbox  checked={fail} onCheckedChange={(v) => setFail(!!v)} />
          最初の試行を意図的に失敗させる（リトライの様子を見る）
        </label>
        <label style={{ fontSize: 13, display: "block", marginBottom: 8 }}>
          冪等キー（同じ値の2回目以降はスキップ）:
          <Input value={idempotencyKey} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setIdempotencyKey(e.target.value)} placeholder="例: 2025-01-daily" style={{ marginLeft: 6, padding: "4px 8px", border: "1px solid #ddd", borderRadius: 6 }} />
        </label>
        <Button onClick={run} disabled={busy} style={{ padding: "8px 20px", background: busy ? "#ccc" : "var(--color-primary, #2563eb)", color: "var(--color-surface, #fff)", border: "none", borderRadius: 8 }}>{busy ? "実行中…" : "サンプル RPA を実行"}</Button>
        {result && <div style={{ marginTop: 12, fontSize: 13, color: "var(--color-success, #16a34a)" }}>成功（{result.rows} 件処理・試行 {result.attempts} 回{result.skipped ? "・冪等スキップ" : ""}）</div>}
        {error && <div style={{ marginTop: 12, fontSize: 13, color: "var(--color-danger, #dc2626)" }}>失敗: {error}</div>}
      </div>

      <div style={{ ...card, marginTop: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>監査ログ（新しい順）</div>
        {events.length === 0 && <p style={{ fontSize: 13, color: "var(--color-muted, #999)" }}>まだ実行されていません。</p>}
        {events.map((e, i) => (
          <div key={i} style={{ fontSize: 12, padding: "4px 0", borderBottom: "1px solid #f5f5f5", display: "flex", gap: 8 }}>
            <code style={{ color: actionColor(e.action), minWidth: 120 }}>{e.action}</code>
            <span style={{ color: "var(--color-muted, #999)" }}>{e.target}</span>
            {e.metadata?.step !== undefined && <span style={{ color: "var(--color-muted, #666)" }}>step {String(e.metadata.step)}/{String(e.metadata.of)}</span>}
            {e.metadata?.attempt !== undefined && <span style={{ color: "var(--color-muted, #999)" }}>試行{String(e.metadata.attempt)}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
