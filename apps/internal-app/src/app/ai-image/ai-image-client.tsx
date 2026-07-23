"use client";
/** AI 画像生成/編集。AI Image Gateway 経由。テキスト同様アプリは直叩きせず、コストがログに計上される。 */
import * as React from "react";
import { Button, Input } from "@platform/ui";

interface Result { images: string[]; model: string; costJpy: number | null; mock: boolean; }

export function AiImageClient({ fetchImpl }: { fetchImpl?: typeof fetch }) {
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;
  const [prompt, setPrompt] = React.useState("");
  const [result, setResult] = React.useState<Result | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");

  const generate = async () => {
    setBusy(true); setError(""); setResult(null);
    try {
      const r = await doFetch("/api/ai/image", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prompt }) });
      const d = await r.json();
      if (r.ok) setResult(d as Result);
      else setError((d as { error?: string }).error ?? "生成に失敗しました");
    } finally { setBusy(false); }
  };

  const card: React.CSSProperties = { background: "var(--color-surface, #fff)", border: "1px solid #e8e8e8", borderRadius: 10, padding: 16 };

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 22 }}>AI 画像生成</h1>
      {result?.mock && <p style={{ fontSize: 12, color: "var(--color-warning, #b45309)", background: "#fffbeb", padding: "8px 12px", borderRadius: 8 }}>モックモードで動作中です（OPENAI_API_KEY 未設定）。プレースホルダ画像を返しますが、Gateway 経由・コスト計上の流れは同じです。</p>}
      <div style={{ ...card, marginTop: 12 }}>
        <Input value={prompt} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPrompt(e.target.value)} placeholder="例: 会社ロゴを水彩風に / 青空の背景" style={{ width: "100%", boxSizing: "border-box", padding: "8px 12px", border: "1px solid #ddd", borderRadius: 8 }} />
        <Button onClick={generate} disabled={busy || prompt.trim().length === 0} style={{ marginTop: 8, padding: "8px 20px", background: busy ? "#ccc" : "var(--color-primary, #2563eb)", color: "var(--color-surface, #fff)", border: "none", borderRadius: 8 }}>{busy ? "生成中…" : "生成する"}</Button>
        {error && <p style={{ color: "var(--color-danger, #c00)", fontSize: 13, marginTop: 8 }}>{error}</p>}
      </div>
      {result && (
        <div style={{ ...card, marginTop: 12 }}>
          <div style={{ fontSize: 12, color: "var(--color-muted, #888)", marginBottom: 8 }}>モデル: {result.model}　コスト: {result.costJpy !== null ? `¥${result.costJpy.toFixed(2)}` : "—"}</div>
          {result.images.map((src, i) => <img key={i} src={src} alt="生成画像" style={{ maxWidth: "100%", borderRadius: 8, border: "1px solid #eee" }} />)}
        </div>
      )}
    </div>
  );
}
