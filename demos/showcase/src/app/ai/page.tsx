"use client";
/** AI Gateway のデモ: ルーティング・フォールバック・コスト集計・トークン上限・PII マスク。 */
import * as React from "react";
import { createAiGateway, createMemoryAiLogStore, type AiProvider, type AiCallLog } from "@platform/ai";

/** 偽プロバイダ。API キー無しで Gateway の振る舞いだけを見せる。 */
function fakeProvider(id: string, models: string[], failing = false): AiProvider {
  return {
    id,
    models,
    async chat(req) {
      await new Promise((r) => setTimeout(r, 120));
      if (failing) throw new Error(`${id} が応答しません`);
      const last = req.messages[req.messages.length - 1]?.content ?? "";
      return {
        text: `【${id} / ${req.model}】「${last.slice(0, 30)}」を受け取りました。`,
        usage: { inputTokens: Math.ceil(last.length / 2), outputTokens: 24 },
      };
    },
  };
}

const logStore = createMemoryAiLogStore();

const gateway = createAiGateway({
  // anthropic はわざと故障させてある(fallback の確認用)
  providers: [fakeProvider("anthropic", ["claude-demo"], true), fakeProvider("openai", ["gpt-demo"])],
  defaultModel: "claude-demo",
  pricing: {
    "claude-demo": { inJpyPer1k: 0.45, outJpyPer1k: 2.25 },
    "gpt-demo": { inJpyPer1k: 0.3, outJpyPer1k: 1.2 },
  },
  limits: { maxTokensPerCall: 256, maxTotalTokens: 2000 },
  // プロンプトを生で保存しない。電話番号を伏せてからログへ。
  redact: (t) => t.replace(/0\d{1,4}-\d{1,4}-\d{4}/g, "***-****-****"),
  logPrompt: true,
  fallback: true,
  logStore,
});

const box: React.CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius)",
  background: "var(--color-surface)",
  padding: 16,
  marginBottom: 16,
};

const field: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: "var(--radius)",
  border: "1px solid var(--color-border)",
  background: "var(--color-bg)",
  color: "var(--color-fg)",
};

export default function Page() {
  const [text, setText] = React.useState("見積書の書き方を教えて。連絡先は 03-1234-5678 です。");
  const [model, setModel] = React.useState("claude-demo");
  const [out, setOut] = React.useState("");
  const [err, setErr] = React.useState("");
  const [logs, setLogs] = React.useState<AiCallLog[]>([]);
  const [totals, setTotals] = React.useState(() => logStore.totals());
  const [used, setUsed] = React.useState(0);
  const [busy, setBusy] = React.useState(false);

  async function run() {
    setBusy(true);
    setErr("");
    setOut("");
    const r = await gateway.chat({ model, messages: [{ role: "user", content: text }], user: "demo-user" });
    if (r.ok) {
      const v = r.value;
      setOut(`${v.text}\n\n— ${v.provider} / ${v.usage.inputTokens}+${v.usage.outputTokens} tok / ${v.costJpy?.toFixed(3) ?? "-"} 円 / ${v.latencyMs}ms`);
    } else {
      setErr(`${r.error.code}: ${r.error.message}`);
    }
    setLogs([...logStore.list()].reverse());
    setTotals(logStore.totals());
    setUsed(gateway.totalTokens());
    setBusy(false);
  }

  return (
    <main style={{ maxWidth: 860, margin: "2.5rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 4 }}>AI Gateway</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted)", lineHeight: 1.8, marginBottom: 20 }}>
        アプリは各社の SDK を直接使わず、<code>@platform/ai</code> を通します。そうすると
        <strong>モデルを設定だけで差し替えられ、コストが全部ログに残り、暴走に上限をかけられます</strong>。
        このデモは API キー不要の偽プロバイダで、Gateway の振る舞いだけを見せます。
      </p>

      <div style={box}>
        <label style={{ display: "block", fontSize: 12, marginBottom: 6 }}>モデル</label>
        <select value={model} onChange={(e) => setModel(e.target.value)} style={{ ...field, marginBottom: 12 }}>
          <option value="claude-demo">claude-demo（このプロバイダは故障中 → fallback で openai へ）</option>
          <option value="gpt-demo">gpt-demo</option>
        </select>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          style={{ ...field, width: "100%", padding: 10, fontFamily: "inherit", marginBottom: 12 }}
        />
        <button
          onClick={run}
          disabled={busy}
          style={{
            padding: "8px 16px",
            borderRadius: "var(--radius)",
            border: "none",
            background: "var(--color-primary)",
            color: "var(--color-primary-fg)",
            cursor: busy ? "wait" : "pointer",
          }}
        >
          {busy ? "呼び出し中…" : "送信"}
        </button>
        {out !== "" && (
          <pre style={{ marginTop: 12, whiteSpace: "pre-wrap", fontSize: 13, background: "var(--color-bg)", padding: 12, borderRadius: "var(--radius)" }}>
            {out}
          </pre>
        )}
        {err !== "" && <p style={{ marginTop: 12, color: "var(--color-danger)", fontSize: 13 }}>{err}</p>}
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>コスト集計</h2>
        <div style={{ display: "flex", gap: 24, fontSize: 13, flexWrap: "wrap" }}>
          <span>呼び出し <b>{totals.calls}</b> 回</span>
          <span>入力 <b>{totals.inputTokens}</b> tok</span>
          <span>出力 <b>{totals.outputTokens}</b> tok</span>
          <span>累計 <b>{totals.costJpy.toFixed(3)}</b> 円</span>
          <span>予算 <b>{used}</b> / 2000 tok</span>
        </div>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 8 }}>
          2000 トークンを超えると、以降の呼び出しは <code>RATE_LIMITED</code> で拒否されます（何度か送って確認できます）。
        </p>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>呼び出しログ</h2>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 8 }}>
          プロンプトは <code>redact</code> を通してから保存されます。電話番号が伏せられているのを確認してください。
        </p>
        {logs.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--color-muted)" }}>まだありません</p>
        ) : (
          <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--color-muted)" }}>
                <th style={{ padding: 4 }}>結果</th>
                <th style={{ padding: 4 }}>provider</th>
                <th style={{ padding: 4 }}>model</th>
                <th style={{ padding: 4 }}>円</th>
                <th style={{ padding: 4 }}>ms</th>
                <th style={{ padding: 4 }}>prompt(redact済) / error</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l, i) => (
                <tr key={`${l.at}-${i}`} style={{ borderTop: "1px solid var(--color-border)" }}>
                  <td style={{ padding: 4 }}>{l.ok ? "○" : "×"}</td>
                  <td style={{ padding: 4 }}>{l.provider}</td>
                  <td style={{ padding: 4 }}>{l.model}</td>
                  <td style={{ padding: 4 }}>{l.costJpy?.toFixed(3) ?? "-"}</td>
                  <td style={{ padding: 4 }}>{l.latencyMs}</td>
                  <td style={{ padding: 4, color: "var(--color-muted)" }}>{l.prompt ?? l.error ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
