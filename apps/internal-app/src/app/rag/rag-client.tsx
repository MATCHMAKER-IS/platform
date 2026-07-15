"use client";
/** 社内文書検索(RAG)。権限継承検索の実挙動(ロールで見える文書が変わる)を体感できる。管理者は文書登録も。 */
import * as React from "react";

interface Hit { title: string; source?: string; text: string; score: number; }

export function RagClient({ fetchImpl }: { fetchImpl?: typeof fetch }) {
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;
  const [query, setQuery] = React.useState("");
  const [hits, setHits] = React.useState<Hit[] | null>(null);
  const [principal, setPrincipal] = React.useState<{ email: string; roles: string[] } | null>(null);
  const [normalization, setNormalization] = React.useState<{ raw: string; corrected: string; changed: boolean } | null>(null);
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  // 登録フォーム(管理者のみ成功)
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [visibility, setVisibility] = React.useState<"public" | "hr" | "admin">("public");
  const [ingestMsg, setIngestMsg] = React.useState("");

  const search = async () => {
    setBusy(true); setError(""); setHits(null);
    try {
      const r = await doFetch("/api/rag/search", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query }) });
      const d = await r.json();
      if (r.ok) { setHits(d.hits as Hit[]); setPrincipal(d.principal); setNormalization(d.normalization ?? null); }
      else setError((d as { error?: string }).error ?? "検索に失敗しました");
    } finally { setBusy(false); }
  };
  const ingest = async () => {
    setIngestMsg("");
    const r = await doFetch("/api/rag/ingest", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title, body, visibility }) });
    const d = await r.json();
    if (r.ok) { setIngestMsg(`登録しました（${d.chunks} チャンク）`); setTitle(""); setBody(""); }
    else setIngestMsg((d as { error?: string }).error ?? "登録に失敗しました");
  };

  const card: React.CSSProperties = { background: "var(--color-surface, #fff)", border: "1px solid #e8e8e8", borderRadius: 10, padding: 16 };

  return (
    <div style={{ maxWidth: 820, margin: "0 auto", padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 22 }}>社内文書検索（RAG）</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted, #666)", lineHeight: 1.6 }}>あなたの権限で見られる文書だけが検索対象になります（権限のない文書は結果に出ません）。管理者は公開範囲を指定して文書を登録できます。</p>

      <div style={{ ...card, marginTop: 12 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={query} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)} placeholder="例: 賞与の計算方法 / 休業 / 経営計画" style={{ flex: 1, padding: "8px 12px", border: "1px solid #ddd", borderRadius: 8 }} />
          <button onClick={search} disabled={busy || query.trim().length === 0} style={{ padding: "8px 20px", background: busy ? "#ccc" : "var(--color-primary, #2563eb)", color: "var(--color-surface, #fff)", border: "none", borderRadius: 8 }}>{busy ? "検索中…" : "検索"}</button>
        </div>
        {error && <p style={{ color: "var(--color-danger, #c00)", fontSize: 13, marginTop: 8 }}>{error}</p>}
        {normalization && normalization.changed && (
          <p style={{ fontSize: 12, marginTop: 8, padding: "6px 10px", background: "#fef9c3", border: "1px solid #fde047", borderRadius: 6, color: "#854d0e" }}>
            辞書補正: 「{normalization.raw}」を「{normalization.corrected}」として検索しました（用語辞書で表記を統一）。
          </p>
        )}
        {principal && <p style={{ fontSize: 12, color: "var(--color-muted, #888)", marginTop: 8 }}>検索者: {principal.email}（ロール: {principal.roles.join(", ") || "なし"}）</p>}
      </div>

      {hits && (
        <div style={{ marginTop: 12 }}>
          {hits.length === 0 && <p style={{ color: "var(--color-muted, #999)" }}>該当する文書がありません（権限のある範囲に一致なし）。</p>}
          {hits.map((h, i) => (
            <div key={i} style={{ ...card, marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong style={{ fontSize: 14 }}>【{i + 1}】{h.title}</strong>
                <span style={{ fontSize: 11, color: "var(--color-muted, #999)" }}>{h.source} · score {h.score}</span>
              </div>
              <p style={{ fontSize: 13, color: "#555", margin: "6px 0 0", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{h.text}</p>
            </div>
          ))}
        </div>
      )}

      <details style={{ marginTop: 20 }}>
        <summary style={{ cursor: "pointer", fontSize: 13, color: "var(--color-muted, #666)" }}>文書を登録（管理者のみ）</summary>
        <div style={{ ...card, marginTop: 8 }}>
          <input value={title} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)} placeholder="タイトル" style={{ width: "100%", boxSizing: "border-box", padding: 8, border: "1px solid #ddd", borderRadius: 6, marginBottom: 8 }} />
          <textarea value={body} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setBody(e.target.value)} placeholder="本文" rows={4} style={{ width: "100%", boxSizing: "border-box", padding: 8, border: "1px solid #ddd", borderRadius: 6, fontFamily: "inherit" }} />
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 8 }}>
            <label style={{ fontSize: 13 }}>公開範囲:
              <select value={visibility} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setVisibility(e.target.value as "public" | "hr" | "admin")} style={{ marginLeft: 6, padding: 4 }}>
                <option value="public">全員</option>
                <option value="hr">人事・管理者</option>
                <option value="admin">管理者のみ</option>
              </select>
            </label>
            <button onClick={ingest} disabled={title.trim().length === 0 || body.trim().length === 0} style={{ marginLeft: "auto", padding: "6px 16px" }}>登録</button>
          </div>
          {ingestMsg && <p style={{ fontSize: 12, color: ingestMsg.includes("登録しました") ? "var(--color-success, #16a34a)" : "var(--color-danger, #c00)", marginTop: 8 }}>{ingestMsg}</p>}
        </div>
      </details>
    </div>
  );
}
