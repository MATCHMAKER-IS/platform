"use client";
/**
 * Platform Debugger のフローティングバー。開発時のみ画面の隅に常駐する。
 *
 * DebugKit の最大の利点は「**画面を見ながらその場で確認できる**」こと。
 * /debug を別タブで開くより、今見ている画面の裏で何が起きたかがすぐ分かる。
 *
 * 本番では API が 404 を返すため、何も表示されない(存在しないのと同じ)。
 * @packageDocumentation
 */
import * as React from "react";

type Kind = "sql" | "api" | "ai" | "event" | "log" | "job";

interface Latest {
  requestId: string;
  method: string;
  path: string;
  status?: number;
  durationMs?: number;
  counts: Record<Kind, number>;
  issueCount: number;
}

const KIND_LABEL: Record<Kind, string> = {
  sql: "SQL", api: "API", ai: "AI", event: "Event", log: "Log", job: "Job",
};

export function DebugBar({ fetchImpl }: { fetchImpl?: typeof fetch }) {
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;
  const [latest, setLatest] = React.useState<Latest | null>(null);
  const [enabled, setEnabled] = React.useState<boolean | null>(null);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await doFetch("/api/debug");
        if (!alive) return;
        if (r.status === 404) { setEnabled(false); return; }
        const d = (await r.json()) as { requests: Latest[] };
        setEnabled(true);
        // 直近のリクエスト(自分自身の /api/debug は除く)
        setLatest(d.requests.find((x) => !x.path.startsWith("/api/debug")) ?? null);
      } catch {
        if (alive) setEnabled(false);
      }
    };
    void load();
    const t = setInterval(() => void load(), 3000);
    return () => { alive = false; clearInterval(t); };
  }, [doFetch]);

  // 無効(本番)なら何も描画しない
  if (enabled !== true) return null;

  const slow = (latest?.durationMs ?? 0) > 1000;
  const hasIssue = (latest?.issueCount ?? 0) > 0;
  const bad = (latest?.status ?? 200) >= 400;

  return (
    <div
      style={{
        position: "fixed", right: 12, bottom: 12, zIndex: 9999,
        fontFamily: "var(--font-family, system-ui, sans-serif)", fontSize: 11,
      }}
    >
      {open && latest && (
        <div
          style={{
            marginBottom: 6, padding: 10, minWidth: 260,
            background: "var(--color-surface, #fff)", color: "var(--color-fg, #111)",
            border: "1px solid var(--color-border, #e5e7eb)", borderRadius: "var(--radius, 10px)",
            boxShadow: "0 4px 16px rgba(0,0,0,.15)",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 4, wordBreak: "break-all" }}>
            {latest.method} {latest.path}
          </div>
          <div style={{ color: "var(--color-muted, #888)", marginBottom: 6 }}>
            {latest.status} ・ {Math.round(latest.durationMs ?? 0)}ms
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            {(Object.keys(KIND_LABEL) as Kind[]).filter((k) => latest.counts[k] > 0).map((k) => (
              <span key={k}>{KIND_LABEL[k]} {latest.counts[k]}</span>
            ))}
          </div>
          {hasIssue && (
            <div style={{ color: "var(--color-warning, #b45309)", marginBottom: 6 }}>
              ⚠ 気になる点が {latest.issueCount} 件
            </div>
          )}
          <a
            href={`/debug`}
            style={{ color: "var(--color-primary, #2563eb)", textDecoration: "none" }}
          >
            詳しく見る →
          </a>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        title="Platform Debugger（開発時のみ表示）"
        style={{
          display: "flex", alignItems: "center", gap: 6, padding: "6px 10px",
          background: bad || hasIssue ? "var(--color-danger, #c00)" : slow ? "var(--color-warning, #d97706)" : "var(--color-fg, #111)",
          color: "#fff", border: "none", borderRadius: 999, cursor: "pointer",
          boxShadow: "0 2px 8px rgba(0,0,0,.2)", fontSize: 11,
        }}
      >
        <span>🔧</span>
        {latest ? (
          <>
            <span>{Math.round(latest.durationMs ?? 0)}ms</span>
            {latest.counts.sql > 0 && <span>SQL {latest.counts.sql}</span>}
            {hasIssue && <span>⚠{latest.issueCount}</span>}
          </>
        ) : (
          <span>Debugger</span>
        )}
      </button>
    </div>
  );
}
