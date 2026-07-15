"use client";
/**
 * 運用ダッシュボード。**障害時に最初に開く画面**。
 * 稼働状況・エラー率・設定の要点を 1 画面に集約し、次にどこを見るかまで示す。
 */
import * as React from "react";

interface Section { name: string; ok: boolean; detail?: string }
interface Metric { name: string; value: string; warn?: boolean }
interface Ops {
  healthy: boolean;
  summary: { up: number; down: number; total: number };
  sections: Section[];
  metrics: Metric[];
  config: Record<string, string>;
  checkedAt: string;
}

/** 異常のときに「次に何をするか」を示す。 */
const NEXT_ACTION: Record<string, string> = {
  データベース: "pnpm db:up で起動しているか / DATABASE_URL が正しいか（/admin/env）",
  "監査ログの整合性": "改ざんの疑い。至急 /admin/audit を確認し、責任者に報告",
  Zoho: "外部 API の障害か認証切れ。サーキットブレーカーが開いています。しばらく待つか、トークンを確認",
  Webhook: "配信先が落ちている可能性。再送キューを確認",
};

export function OpsClient({ fetchImpl }: { fetchImpl?: typeof fetch }) {
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;
  const [ops, setOps] = React.useState<Ops | null>(null);
  const [error, setError] = React.useState("");
  const [auto, setAuto] = React.useState(true);

  const load = React.useCallback(async () => {
    const r = await doFetch("/api/admin/ops");
    const d = (await r.json()) as Ops & { error?: string };
    if (r.ok) { setOps(d); setError(""); }
    else setError(d.error ?? "取得に失敗しました");
  }, [doFetch]);

  React.useEffect(() => {
    void load();
    if (!auto) return;
    const t = setInterval(() => void load(), 10_000);
    return () => clearInterval(t);
  }, [load, auto]);

  if (error) return <div style={{ padding: 40, color: "var(--color-danger, #c00)" }}>{error}</div>;
  if (!ops) return <div style={{ padding: 40, color: "var(--color-muted, #888)" }}>読み込み中…</div>;

  const card: React.CSSProperties = {
    background: "var(--color-surface, #fff)",
    border: "1px solid var(--color-border, #e5e7eb)",
    borderRadius: "var(--radius, 10px)",
    padding: 16,
    marginBottom: 12,
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>運用ダッシュボード</h1>
        <label style={{ fontSize: 12, color: "var(--color-muted, #888)", display: "flex", alignItems: "center", gap: 6 }}>
          <input type="checkbox" checked={auto} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAuto(e.target.checked)} />
          10秒ごとに自動更新
        </label>
      </div>

      {/* 総合判定 */}
      <div style={{ ...card, borderLeft: `4px solid ${ops.healthy ? "var(--color-success, #16a34a)" : "var(--color-danger, #c00)"}` }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>
          {ops.healthy ? "✅ 正常" : "❌ 異常あり"}
          <span style={{ fontSize: 12, fontWeight: 400, color: "var(--color-muted, #888)", marginLeft: 12 }}>
            {ops.summary.up}/{ops.summary.total} 稼働 ・ {new Date(ops.checkedAt).toLocaleTimeString("ja-JP")} 時点
          </span>
        </div>
        {!ops.healthy && (
          <p style={{ fontSize: 13, margin: "8px 0 0" }}>
            下の ❌ を確認してください。対応手順は{" "}
            <a href="https://github.com" style={{ color: "var(--color-primary, #2563eb)" }}>docs/ops/INCIDENT_RESPONSE.md</a>
          </p>
        )}
      </div>

      {/* 稼働状況 */}
      <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>稼働状況</div>
        {ops.sections.map((s) => (
          <div key={s.name} style={{ padding: "6px 0", borderTop: "1px solid var(--color-border, #f3f4f6)" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
              <span>{s.ok ? "✅" : "❌"}</span>
              <strong>{s.name}</strong>
              {s.detail && <span style={{ color: "var(--color-muted, #888)", fontSize: 12 }}>{s.detail}</span>}
            </div>
            {!s.ok && NEXT_ACTION[s.name] && (
              <div style={{ fontSize: 12, color: "var(--color-warning, #b45309)", marginLeft: 24, marginTop: 2 }}>
                → {NEXT_ACTION[s.name]}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 指標 */}
      <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>指標</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 8 }}>
          {ops.metrics.map((m) => (
            <div key={m.name} style={{ padding: 8, borderRadius: 8, background: "var(--color-bg, #f9fafb)" }}>
              <div style={{ fontSize: 11, color: "var(--color-muted, #888)" }}>{m.name}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: m.warn ? "var(--color-danger, #c00)" : "var(--color-fg, #111)" }}>{m.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 設定の要点 */}
      <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>設定の要点</div>
        <p style={{ fontSize: 11, color: "var(--color-muted, #888)", margin: "0 0 8px" }}>
          「設定漏れでは?」を即確認するための抜粋（秘密値はマスク）。全部は <a href="/admin/env" style={{ color: "var(--color-primary, #2563eb)" }}>設定の確認</a> へ
        </p>
        {Object.entries(ops.config).map(([k, v]) => (
          <div key={k} style={{ display: "flex", gap: 8, fontSize: 12, padding: "3px 0" }}>
            <code style={{ minWidth: 180 }}>{k}</code>
            <span style={{ color: v ? "var(--color-fg, #111)" : "var(--color-muted, #bbb)" }}>{v || "(未設定)"}</span>
          </div>
        ))}
      </div>

      {/* 調査の導線 */}
      <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>次に見るところ</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 13 }}>
          {[
            ["設定の確認", "/admin/env"],
            ["DB の中身", "/admin/db-viewer"],
            ["監査ログ", "/admin/audit"],
            ["メンテナンスモード", "/admin/maintenance"],
          ].map(([label, href]) => (
            <a key={href} href={href} style={{
              padding: "6px 12px", border: "1px solid var(--color-border, #ddd)", borderRadius: 8,
              textDecoration: "none", color: "var(--color-fg, #111)",
            }}>{label}</a>
          ))}
        </div>
      </div>
    </div>
  );
}
