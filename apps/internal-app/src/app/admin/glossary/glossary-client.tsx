"use client";
/** 補正辞書の管理。非エンジニアが表記ゆれ(from→to)と固有名詞を編集できる。 */
import * as React from "react";

interface Rule { from: string; to: string; }

export function GlossaryClient({ fetchImpl }: { fetchImpl?: typeof fetch }) {
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;
  const [rules, setRules] = React.useState<Rule[]>([]);
  const [terms, setTerms] = React.useState<string[]>([]);
  const [persistent, setPersistent] = React.useState<boolean | null>(null);
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [term, setTerm] = React.useState("");
  const [audit, setAudit] = React.useState<{ kind: string; action: string; key: string; value?: string; at: string; actor: string }[]>([]);
  const [showAudit, setShowAudit] = React.useState(false);
  const [csvMsg, setCsvMsg] = React.useState("");

  const load = async () => {
    const r = await doFetch("/api/rag/glossary");
    const d = await r.json();
    if (r.ok) { setRules(d.replacements as Rule[]); setTerms(d.terms as string[]); setPersistent(typeof d.persistent === "boolean" ? d.persistent : null); }
  };
  React.useEffect(() => { void load(); }, []);

  const addRule = async () => {
    if (!from.trim()) return;
    const r = await doFetch("/api/rag/glossary", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ from, to }) });
    if (r.ok) { setFrom(""); setTo(""); await load(); }
  };
  const delRule = async (f: string) => {
    const r = await doFetch(`/api/rag/glossary?from=${encodeURIComponent(f)}`, { method: "DELETE" });
    if (r.ok) await load();
  };
  const addTerm = async () => {
    if (!term.trim()) return;
    const r = await doFetch("/api/rag/glossary", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ term }) });
    if (r.ok) { setTerm(""); await load(); }
  };
  const delTerm = async (t: string) => {
    const r = await doFetch(`/api/rag/glossary?term=${encodeURIComponent(t)}`, { method: "DELETE" });
    if (r.ok) await load();
  };
  const loadAudit = async () => {
    const r = await doFetch("/api/rag/glossary?audit=1");
    const d = await r.json();
    if (r.ok) { setAudit(d.audit ?? []); setShowAudit(true); }
  };
  const exportCsv = (kind: "replacements" | "terms") => {
    if (typeof window !== "undefined") window.open(`/api/rag/glossary/csv?kind=${kind}`, "_blank");
  };
  const importCsv = async (kind: "replacements" | "terms", file: File) => {
    setCsvMsg("");
    const csv = await file.text();
    const r = await doFetch("/api/rag/glossary/csv", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind, csv }) });
    const d = await r.json();
    if (r.ok) { setCsvMsg(`取り込み: ${d.added} 件追加 / ${d.skipped} 件スキップ`); await load(); }
    else setCsvMsg((d as { error?: string }).error ?? "取り込みに失敗しました");
  };

  const card: React.CSSProperties = { background: "var(--color-surface, #fff)", border: "1px solid #e8e8e8", borderRadius: 10, padding: 16 };
  const input: React.CSSProperties = { padding: "6px 10px", border: "1px solid #ddd", borderRadius: 6 };

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 22 }}>補正辞書の管理</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted, #666)", lineHeight: 1.6 }}>音声認識の誤変換や表記ゆれを登録します。ここで登録した内容は、文字起こし取り込みと検索クエリの両方に適用されます。</p>
      {persistent !== null && (
        <p style={{ fontSize: 12, marginTop: 4, display: "inline-block", padding: "3px 10px", borderRadius: 12, background: persistent ? "#dcfce7" : "#fef9c3", color: persistent ? "#166534" : "#854d0e" }}>
          {persistent ? "永続化: 有効（DB に保存され、再起動後も残ります）" : "永続化: 無効（メモリのみ・再起動で初期値に戻ります）"}
        </p>
      )}

      <div style={{ ...card, marginTop: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>置換ルール（from → to）</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input value={from} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFrom(e.target.value)} placeholder="誤変換（例: 議事六）" style={{ ...input, flex: 1 }} />
          <span style={{ alignSelf: "center" }}>→</span>
          <input value={to} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTo(e.target.value)} placeholder="正しい表記（例: 議事録）" style={{ ...input, flex: 1 }} />
          <button onClick={addRule} disabled={from.trim().length === 0} style={{ ...input, background: "var(--color-primary, #2563eb)", color: "var(--color-surface, #fff)", border: "none" }}>追加</button>
        </div>
        {rules.map((r) => (
          <div key={r.from} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", borderBottom: "1px solid #f5f5f5", fontSize: 13 }}>
            <code>{r.from}</code><span style={{ color: "var(--color-muted, #999)" }}>→</span><code>{r.to}</code>
            <button onClick={() => delRule(r.from)} style={{ marginLeft: "auto", fontSize: 11, color: "var(--color-danger, #c00)", background: "none", border: "none", cursor: "pointer" }}>削除</button>
          </div>
        ))}
      </div>

      <div style={{ ...card, marginTop: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>固有名詞（LLM ヒント用）</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input value={term} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTerm(e.target.value)} placeholder="固有名詞・専門用語" style={{ ...input, flex: 1 }} />
          <button onClick={addTerm} disabled={term.trim().length === 0} style={{ ...input, background: "var(--color-primary, #2563eb)", color: "var(--color-surface, #fff)", border: "none" }}>追加</button>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {terms.map((t) => (
            <span key={t} style={{ fontSize: 12, background: "#eef2ff", color: "#4338ca", padding: "3px 6px 3px 10px", borderRadius: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>
              {t}
              <button onClick={() => delTerm(t)} title="削除" style={{ fontSize: 11, color: "#6366f1", background: "none", border: "none", cursor: "pointer", padding: 0, lineHeight: 1 }}>×</button>
            </span>
          ))}
        </div>
      </div>

      <div style={{ ...card, marginTop: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>CSV 入出力（バックアップ・一括登録）</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button onClick={() => exportCsv("replacements")} style={{ ...input }}>置換ルールを書き出し</button>
          <button onClick={() => exportCsv("terms")} style={{ ...input }}>固有名詞を書き出し</button>
          <label style={{ ...input, cursor: "pointer", background: "#f9fafb" }}>
            置換ルールを取込
            <input type="file" accept=".csv" style={{ display: "none" }} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) void importCsv("replacements", f); }} />
          </label>
          <label style={{ ...input, cursor: "pointer", background: "#f9fafb" }}>
            固有名詞を取込
            <input type="file" accept=".csv" style={{ display: "none" }} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) void importCsv("terms", f); }} />
          </label>
        </div>
        {csvMsg && <p style={{ fontSize: 12, color: csvMsg.includes("取り込み") ? "var(--color-success, #16a34a)" : "var(--color-danger, #c00)", marginTop: 8 }}>{csvMsg}</p>}
        <p style={{ fontSize: 11, color: "var(--color-muted, #999)", marginTop: 6 }}>CSV は from,to（置換ルール）または term（固有名詞）の列。Excel で編集できます。</p>
      </div>

      <div style={{ ...card, marginTop: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>変更履歴</div>
          <button onClick={loadAudit} style={{ ...input, fontSize: 12 }}>履歴を表示</button>
        </div>
        {showAudit && (
          <div style={{ marginTop: 8 }}>
            {audit.length === 0 && <p style={{ fontSize: 12, color: "var(--color-muted, #999)" }}>まだ変更履歴がありません。</p>}
            {audit.map((e, i) => (
              <div key={i} style={{ fontSize: 12, padding: "4px 0", borderBottom: "1px solid #f5f5f5", display: "flex", gap: 8 }}>
                <span style={{ color: "var(--color-muted, #999)", minWidth: 130 }}>{new Date(e.at).toLocaleString("ja-JP")}</span>
                <span style={{ color: e.action === "remove" ? "var(--color-danger, #c00)" : "#4338ca", minWidth: 50 }}>{e.action === "add" ? "追加" : e.action === "update" ? "更新" : "削除"}</span>
                <code>{e.kind === "term" ? "用語" : "置換"}: {e.key}{e.value ? ` → ${e.value}` : ""}</code>
                <span style={{ marginLeft: "auto", color: "var(--color-muted, #999)" }}>{e.actor}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
