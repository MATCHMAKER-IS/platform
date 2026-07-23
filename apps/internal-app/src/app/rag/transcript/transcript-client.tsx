"use client";
/** 文字起こし取り込み。辞書で表記を補正してから RAG に投入し、補正差分を見せる。 */
import * as React from "react";
import { Button, Input, Select, Textarea } from "@platform/ui";

export function TranscriptClient({ fetchImpl }: { fetchImpl?: typeof fetch }) {
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;
  const [title, setTitle] = React.useState("");
  const [text, setText] = React.useState("");
  const [visibility, setVisibility] = React.useState<"public" | "hr" | "admin">("hr");
  const [result, setResult] = React.useState<{ chunks: number; corrected: string; changed: boolean } | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");

  const submit = async () => {
    setBusy(true); setError(""); setResult(null);
    try {
      const r = await doFetch("/api/rag/transcript", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title, text, visibility }) });
      const d = await r.json();
      if (r.ok) setResult(d as { chunks: number; corrected: string; changed: boolean });
      else setError((d as { error?: string }).error ?? "取り込みに失敗しました");
    } finally { setBusy(false); }
  };

  const card: React.CSSProperties = { background: "var(--color-surface, #fff)", border: "1px solid #e8e8e8", borderRadius: 10, padding: 16 };

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 22 }}>文字起こし取り込み（辞書補正）</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted, #666)", lineHeight: 1.6 }}>音声認識の定型的な誤変換（例: 議事六→議事録、ケーピーアイ→KPI）を辞書で補正してから RAG に取り込みます。補正後のテキストが検索対象になります。</p>
      <div style={{ ...card, marginTop: 12 }}>
        <Input value={title} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)} placeholder="タイトル（例: 4月定例MTG 議事録）" style={{ width: "100%", boxSizing: "border-box", padding: 8, border: "1px solid #ddd", borderRadius: 6, marginBottom: 8 }} />
        <Textarea value={text} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setText(e.target.value)} placeholder="文字起こしテキストを貼り付け" rows={6} style={{ width: "100%", boxSizing: "border-box", padding: 8, border: "1px solid #ddd", borderRadius: 6, fontFamily: "inherit" }} />
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 8 }}>
          <label style={{ fontSize: 13 }}>公開範囲:
            <Select value={visibility} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setVisibility(e.target.value as "public" | "hr" | "admin")} style={{ marginLeft: 6, padding: 4 }} options={[{ label: "全員", value: "public" }, { label: "人事・管理者", value: "hr" }, { label: "管理者のみ", value: "admin" }]} />
          </label>
          <Button onClick={submit} disabled={busy || title.trim().length === 0 || text.trim().length === 0} style={{ marginLeft: "auto", padding: "8px 20px", background: busy ? "#ccc" : "var(--color-primary, #2563eb)", color: "var(--color-surface, #fff)", border: "none", borderRadius: 8 }}>{busy ? "取り込み中…" : "補正して取り込む"}</Button>
        </div>
        {error && <p style={{ color: "var(--color-danger, #c00)", fontSize: 13, marginTop: 8 }}>{error}</p>}
      </div>
      {result && (
        <div style={{ ...card, marginTop: 12 }}>
          <div style={{ fontSize: 13, color: "var(--color-success, #16a34a)", marginBottom: 8 }}>取り込み完了（{result.chunks} チャンク）{result.changed ? "・辞書補正あり" : "・補正なし"}</div>
          {result.changed && (
            <div>
              <div style={{ fontSize: 12, color: "var(--color-muted, #888)", marginBottom: 4 }}>補正後テキスト:</div>
              <pre style={{ fontSize: 12, background: "#f8f8f8", padding: 12, borderRadius: 8, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{result.corrected}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
