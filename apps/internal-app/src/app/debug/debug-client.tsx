"use client";
/**
 * Platform Debugger の画面。開発時のみ表示される(本番は API が 404 を返す)。
 *
 * 「1 リクエストの中で何が起きたか」を時系列で見せる。
 * ブラウザの DevTools はブラウザ側しか見えないが、ここはサーバの中が見える。
 */
import * as React from "react";
import { Button, Checkbox } from "@platform/ui";

type Kind = "sql" | "api" | "ai" | "event" | "log" | "job";

interface ListItem {
  requestId: string;
  method: string;
  path: string;
  status?: number;
  durationMs?: number;
  startedAt: number;
  counts: Record<Kind, number>;
  issueCount: number;
}
interface DebugEvent { kind: Kind; label: string; atMs: number; durationMs: number; ok: boolean; meta?: Record<string, string | number | boolean> }
interface Detail {
  request: { requestId: string; method: string; path: string; status?: number; durationMs?: number; userId?: string; events: DebugEvent[] };
  summary: { counts: Record<Kind, number>; durations: Record<Kind, number>; failures: number; slowSql: number; duplicateSql: number };
  issues: string[];
}

const KIND_COLOR: Record<Kind, string> = {
  sql: "#2563eb", api: "#7c3aed", ai: "#0891b2", event: "#16a34a", log: "#6b7280", job: "#d97706",
};
const KIND_LABEL: Record<Kind, string> = {
  sql: "SQL", api: "外部API", ai: "AI", event: "イベント", log: "ログ", job: "ジョブ",
};

export function DebugClient({ fetchImpl }: { fetchImpl?: typeof fetch }) {
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;
  const [list, setList] = React.useState<ListItem[] | null>(null);
  const [detail, setDetail] = React.useState<Detail | null>(null);
  const [disabled, setDisabled] = React.useState(false);
  const [auto, setAuto] = React.useState(true);

  const load = React.useCallback(async () => {
    const r = await doFetch("/api/debug");
    if (r.status === 404) { setDisabled(true); return; }
    const d = (await r.json()) as { requests: ListItem[] };
    setList(d.requests);
  }, [doFetch]);

  const open = async (id: string) => {
    const r = await doFetch(`/api/debug?id=${encodeURIComponent(id)}`);
    if (r.ok) setDetail((await r.json()) as Detail);
  };

  const clear = async () => {
    await doFetch("/api/debug", { method: "DELETE" });
    setDetail(null);
    await load();
  };

  React.useEffect(() => {
    void load();
    if (!auto) return;
    const t = setInterval(() => void load(), 3000);
    return () => clearInterval(t);
  }, [load, auto]);

  if (disabled) {
    return (
      <div style={{ maxWidth: 700, margin: "40px auto", padding: 24 }}>
        <h1 style={{ fontSize: 20 }}>Platform Debugger は無効です</h1>
        <p style={{ fontSize: 13, lineHeight: 1.8, color: "var(--color-muted, #666)" }}>
          開発環境で <code>.env</code> に <code>DEBUG_TOOL=true</code> を設定して再起動してください。
          <br />
          <strong>本番環境では有効にできません</strong>（<code>NODE_ENV=production</code> のとき強制的に無効）。
        </p>
      </div>
    );
  }

  const card: React.CSSProperties = {
    background: "var(--color-surface, #fff)",
    border: "1px solid var(--color-border, #e5e7eb)",
    borderRadius: "var(--radius, 10px)",
    padding: 16,
    marginBottom: 12,
  };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, margin: 0 }}>Platform Debugger</h1>
          <p style={{ fontSize: 12, color: "var(--color-muted, #888)", margin: "4px 0 0" }}>
            サーバの中で何が起きたかを見る（開発時のみ）。ブラウザの DevTools と合わせて使ってください
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <label style={{ fontSize: 12, color: "var(--color-muted, #888)", display: "flex", alignItems: "center", gap: 4 }}>
            <Checkbox  checked={auto} onCheckedChange={(v) => setAuto(!!v)} />
            自動更新
          </label>
          <Button onClick={() => void clear()} style={{ padding: "6px 12px", border: "1px solid var(--color-border, #ddd)", borderRadius: 8, background: "var(--color-surface, #fff)", fontSize: 12, cursor: "pointer" }}>
            記録を消す
          </Button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: detail ? "380px 1fr" : "1fr", gap: 12, marginTop: 16 }}>
        {/* 一覧 */}
        <div style={card}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>リクエスト（{list?.length ?? 0}）</div>
          {list === null && <p style={{ fontSize: 12, color: "var(--color-muted, #999)" }}>読み込み中…</p>}
          {list?.length === 0 && (
            <p style={{ fontSize: 12, color: "var(--color-muted, #999)" }}>
              まだ記録がありません。アプリを操作すると、ここに出ます。
            </p>
          )}
          {list?.map((r) => (
            <Button
              key={r.requestId}
              onClick={() => void open(r.requestId)}
              style={{
                display: "block", width: "100%", textAlign: "left", padding: "8px 6px", border: "none",
                borderTop: "1px solid var(--color-border, #f3f4f6)", background: detail?.request.requestId === r.requestId ? "var(--color-bg, #f5f7fa)" : "transparent",
                cursor: "pointer", fontSize: 12,
              }}
            >
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span style={{ fontWeight: 700, color: (r.status ?? 0) >= 400 ? "var(--color-danger, #c00)" : "var(--color-success, #16a34a)" }}>
                  {r.status ?? "…"}
                </span>
                <code style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.method} {r.path}</code>
                <span style={{ color: (r.durationMs ?? 0) > 1000 ? "var(--color-danger, #c00)" : "var(--color-muted, #888)" }}>
                  {r.durationMs !== undefined ? `${Math.round(r.durationMs)}ms` : ""}
                </span>
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 3, fontSize: 10, color: "var(--color-muted, #999)" }}>
                {(Object.keys(KIND_LABEL) as Kind[]).filter((k) => r.counts[k] > 0).map((k) => (
                  <span key={k} style={{ color: KIND_COLOR[k] }}>{KIND_LABEL[k]} {r.counts[k]}</span>
                ))}
                {r.issueCount > 0 && <span style={{ color: "var(--color-warning, #d97706)", marginLeft: "auto" }}>⚠ {r.issueCount}</span>}
              </div>
            </Button>
          ))}
        </div>

        {/* 詳細（タイムライン） */}
        {detail && (
          <div>
            <div style={card}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>
                {detail.request.method} {detail.request.path}
                <span style={{ fontWeight: 400, fontSize: 12, color: "var(--color-muted, #888)", marginLeft: 8 }}>
                  {detail.request.status} ・ {Math.round(detail.request.durationMs ?? 0)}ms
                  {detail.request.userId && ` ・ ${detail.request.userId}`}
                </span>
              </div>

              {/* 気になる点 */}
              {detail.issues.length > 0 && (
                <div style={{ marginTop: 8, padding: 8, borderRadius: 8, background: "var(--color-bg, #fffbeb)", border: "1px solid var(--color-warning, #fde68a)" }}>
                  {detail.issues.map((i, n) => (
                    <div key={n} style={{ fontSize: 12, color: "var(--color-warning, #92400e)" }}>⚠ {i}</div>
                  ))}
                </div>
              )}

              {/* 内訳 */}
              <div style={{ display: "flex", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
                {(Object.keys(KIND_LABEL) as Kind[]).filter((k) => detail.summary.counts[k] > 0).map((k) => (
                  <div key={k} style={{ fontSize: 11 }}>
                    <span style={{ color: KIND_COLOR[k], fontWeight: 700 }}>{KIND_LABEL[k]}</span>
                    <span style={{ color: "var(--color-muted, #888)" }}> {detail.summary.counts[k]} 件 / {Math.round(detail.summary.durations[k])}ms</span>
                  </div>
                ))}
              </div>
            </div>

            {/* タイムライン */}
            <div style={card}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>タイムライン</div>
              {detail.request.events.length === 0 && (
                <p style={{ fontSize: 12, color: "var(--color-muted, #999)" }}>
                  記録された処理がありません。SQL などを記録するには、呼び出し側で <code>debugCollector.record()</code> を呼びます。
                </p>
              )}
              {detail.request.events.map((e, i) => {
                const total = detail.request.durationMs ?? 1;
                const left = Math.min(100, (e.atMs / total) * 100);
                const width = Math.max(1, Math.min(100 - left, (e.durationMs / total) * 100));
                return (
                  <div key={i} style={{ padding: "4px 0", borderTop: i > 0 ? "1px solid var(--color-border, #f3f4f6)" : "none" }}>
                    <div style={{ display: "flex", gap: 8, fontSize: 11, alignItems: "center" }}>
                      <span style={{ color: KIND_COLOR[e.kind], fontWeight: 700, minWidth: 50 }}>{KIND_LABEL[e.kind]}</span>
                      <code style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.label}</code>
                      {!e.ok && <span style={{ color: "var(--color-danger, #c00)" }}>失敗</span>}
                      <span style={{ color: "var(--color-muted, #888)", minWidth: 50, textAlign: "right" }}>{Math.round(e.durationMs)}ms</span>
                    </div>
                    {/* 帯グラフ（いつ・どれだけかかったか） */}
                    <div style={{ position: "relative", height: 4, background: "var(--color-bg, #f3f4f6)", borderRadius: 2, marginTop: 2 }}>
                      <div style={{ position: "absolute", left: `${left}%`, width: `${width}%`, height: "100%", background: KIND_COLOR[e.kind], borderRadius: 2 }} />
                    </div>
                    {e.meta && (
                      <div style={{ fontSize: 10, color: "var(--color-muted, #999)", marginTop: 2 }}>
                        {Object.entries(e.meta).map(([k, v]) => `${k}: ${v}`).join(" / ")}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
