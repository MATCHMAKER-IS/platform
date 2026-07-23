"use client";
/** AI 文書要約 + 利用状況(コスト)。AI Gateway 経由で、実行のたびにコストが計上される様子を見せる。 */
import * as React from "react";
import { Button, Textarea } from "@platform/ui";

interface Usage { inputTokens: number; outputTokens: number; }
interface SummarizeResult { summary: string; usage: Usage; costJpy: number | null; model: string; mock: boolean; }
interface Totals { calls: number; inputTokens: number; outputTokens: number; costJpy: number; byUser: Record<string, { calls: number; costJpy: number }>; }
interface RecentLog { at: string; model: string; user?: string; ok: boolean; latencyMs: number; costJpy: number | null; error?: string; }

export function AiClient({ fetchImpl }: { fetchImpl?: typeof fetch }) {
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;
  const [text, setText] = React.useState("");
  const [style, setStyle] = React.useState<"short" | "bullet">("short");
  const [result, setResult] = React.useState<SummarizeResult | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [usage, setUsage] = React.useState<{ totals: Totals; recent: RecentLog[]; mock: boolean } | null>(null);

  const loadUsage = React.useCallback(async () => {
    const r = await doFetch("/api/ai/usage");
    if (r.ok) setUsage(await r.json());
  }, [doFetch]);
  React.useEffect(() => { void loadUsage(); }, [loadUsage]);

  const summarize = async () => {
    setBusy(true); setError(""); setResult(null);
    try {
      const r = await doFetch("/api/ai/summarize", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, style }) });
      const d = await r.json();
      if (r.ok) { setResult(d as SummarizeResult); await loadUsage(); }
      else setError((d as { error?: string }).error ?? "要約に失敗しました");
    } finally { setBusy(false); }
  };

  const card: React.CSSProperties = { background: "var(--color-surface, #fff)", border: "1px solid #e8e8e8", borderRadius: 10, padding: 16 };
  const yen = (n: number) => `¥${n.toFixed(4)}`;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 22 }}>AI アシスタント（文書要約）</h1>
      {usage?.mock && <p style={{ fontSize: 12, color: "var(--color-warning, #b45309)", background: "#fffbeb", padding: "8px 12px", borderRadius: 8 }}>モックモードで動作中です（ANTHROPIC_API_KEY 未設定）。要約はダミー文言ですが、コスト集計の流れは同じです。</p>}

      <div style={{ ...card, marginTop: 16 }}>
        <Textarea value={text} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setText(e.target.value)} placeholder="要約したい文章を貼り付けてください" rows={8} style={{ width: "100%", boxSizing: "border-box", padding: 10, border: "1px solid #ddd", borderRadius: 8, fontFamily: "inherit" }} />
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 8 }}>
          <label style={{ fontSize: 13 }}><input type="radio" checked={style === "short"} onChange={() => setStyle("short")} /> 短文</label>
          <label style={{ fontSize: 13 }}><input type="radio" checked={style === "bullet"} onChange={() => setStyle("bullet")} /> 箇条書き</label>
          <Button onClick={summarize} disabled={busy || text.trim().length === 0} style={{ marginLeft: "auto", padding: "8px 20px", background: busy ? "#ccc" : "var(--color-primary, #2563eb)", color: "var(--color-surface, #fff)", border: "none", borderRadius: 8, cursor: busy ? "default" : "pointer" }}>{busy ? "要約中…" : "要約する"}</Button>
        </div>
        {error && <p style={{ color: "var(--color-danger, #c00)", fontSize: 13, marginTop: 8 }}>{error}</p>}
      </div>

      {result && (
        <div style={{ ...card, marginTop: 12 }}>
          <div style={{ fontSize: 12, color: "var(--color-muted, #888)", marginBottom: 6 }}>要約結果（{result.model}）</div>
          <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>{result.summary}</div>
          <div style={{ fontSize: 12, color: "var(--color-muted, #888)", marginTop: 10, borderTop: "1px solid #f0f0f0", paddingTop: 8 }}>
            トークン: 入力 {result.usage.inputTokens} / 出力 {result.usage.outputTokens}　コスト: {result.costJpy !== null ? yen(result.costJpy) : "—"}
          </div>
        </div>
      )}

      {usage && (
        <div style={{ ...card, marginTop: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>利用状況（管理者向け）</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10, marginBottom: 12 }}>
            <div><div style={{ fontSize: 11, color: "var(--color-muted, #888)" }}>累計コール</div><div style={{ fontSize: 18, fontWeight: 600 }}>{usage.totals.calls}</div></div>
            <div><div style={{ fontSize: 11, color: "var(--color-muted, #888)" }}>累計コスト</div><div style={{ fontSize: 18, fontWeight: 600 }}>{yen(usage.totals.costJpy)}</div></div>
            <div><div style={{ fontSize: 11, color: "var(--color-muted, #888)" }}>入力トークン</div><div style={{ fontSize: 18, fontWeight: 600 }}>{usage.totals.inputTokens.toLocaleString()}</div></div>
            <div><div style={{ fontSize: 11, color: "var(--color-muted, #888)" }}>出力トークン</div><div style={{ fontSize: 18, fontWeight: 600 }}>{usage.totals.outputTokens.toLocaleString()}</div></div>
          </div>
          {usage.recent.length > 0 && (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead><tr style={{ color: "var(--color-muted, #888)", textAlign: "left", borderBottom: "1px solid #eee" }}><th style={{ padding: 4 }}>時刻</th><th>利用者</th><th>モデル</th><th>遅延</th><th>コスト</th></tr></thead>
              <tbody>
                {usage.recent.map((r, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #f5f5f5" }}>
                    <td style={{ padding: 4 }}>{r.at.slice(11, 19)}</td>
                    <td>{r.user ?? "—"}</td>
                    <td>{r.model}</td>
                    <td>{r.latencyMs}ms</td>
                    <td>{r.costJpy !== null ? yen(r.costJpy) : (r.ok ? "—" : "失敗")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
