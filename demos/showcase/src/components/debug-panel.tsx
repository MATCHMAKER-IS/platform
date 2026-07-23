"use client";
/**
 * CakePHP DebugKit 風のデバッグツールバー（ショーケース用・クライアント側）。
 * - ルート / タイミング / ストレージ / 環境 を可視化する。
 * - 本番では無効：process.env.NODE_ENV === "production" のとき何も描画しない。
 *   加えて、手動でこのセッションだけ非表示にもできる（localStorage）。
 * - サーバ側の「1リクエストで何が起きたか（SQL/API/AI・N+1）」は基盤の
 *   @platform/debug（createDebugCollector, enabled:false で本番オフ）が担当。
 */
import * as React from "react";
import { Button } from "@platform/ui";
import { usePathname } from "next/navigation";

const IS_PROD = process.env.NODE_ENV === "production";
const TABS = [
  { id: "route", label: "ルート" },
  { id: "timing", label: "タイミング" },
  { id: "storage", label: "ストレージ" },
  { id: "env", label: "環境" },
  { id: "server", label: "サーバー" },
] as const;

function ms(n: number): string { return `${Math.max(0, Math.round(n))} ms`; }
function bytes(n: number): string { return n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`; }

export function DebugPanel() {
  const pathname = usePathname();
  const [enabled, setEnabled] = React.useState(true);
  const [open, setOpen] = React.useState(false);
  const [tab, setTab] = React.useState<string>("route");
  const [tick, setTick] = React.useState(0); // 開くたびに再計測

  React.useEffect(() => { try { setEnabled(localStorage.getItem("debug-panel-off") !== "1"); } catch { /* noop */ } }, []);
  React.useEffect(() => { if (open) setTick((t) => t + 1); }, [open]);

  const query = React.useMemo(() => {
    if (typeof window === "undefined") return [] as [string, string][];
    return Array.from(new URLSearchParams(window.location.search).entries());
  }, [tick]);

  const timing = React.useMemo(() => {
    if (typeof performance === "undefined") return null;
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (!nav) return null;
    return {
      dns: nav.domainLookupEnd - nav.domainLookupStart,
      tcp: nav.connectEnd - nav.connectStart,
      ttfb: nav.responseStart - nav.requestStart,
      dom: nav.domContentLoadedEventEnd - nav.startTime,
      load: nav.loadEventEnd - nav.startTime,
    };
  }, [tick]);

  const storage = React.useMemo(() => {
    if (typeof localStorage === "undefined") return { items: [] as { key: string; size: number }[], total: 0 };
    const items: { key: string; size: number }[] = [];
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      const size = key.length + (localStorage.getItem(key)?.length ?? 0);
      total += size;
      items.push({ key, size });
    }
    items.sort((a, b) => b.size - a.size);
    return { items, total };
  }, [tick]);

  const env = React.useMemo(() => {
    if (typeof window === "undefined") return null;
    return {
      mode: process.env.NODE_ENV ?? "unknown",
      viewport: `${window.innerWidth} × ${window.innerHeight}`,
      dpr: window.devicePixelRatio,
      language: navigator.language,
      online: navigator.onLine,
      ua: navigator.userAgent,
    };
  }, [tick]);

  if (IS_PROD || !enabled) return null;

  const th: React.CSSProperties = { textAlign: "left", padding: "4px 8px", color: "var(--color-muted)", fontWeight: 600, whiteSpace: "nowrap" };
  const td: React.CSSProperties = { padding: "4px 8px", fontFamily: "monospace", wordBreak: "break-all" };

  return (
    <>
      <Button type="button" onClick={() => setOpen((o) => !o)} title="デバッグパネル（開発時のみ）"
        style={{ position: "fixed", left: 16, bottom: 16, zIndex: 90, width: 40, height: 40, borderRadius: 999, cursor: "pointer", border: "1px solid var(--color-border)", background: open ? "var(--color-primary)" : "var(--color-surface)", color: open ? "var(--color-primary-fg)" : "var(--color-fg)", boxShadow: "0 4px 14px rgba(0,0,0,0.25)", fontSize: 18 }}>
        🐞
      </Button>

      {open && (
        <div style={{ position: "fixed", left: 16, bottom: 64, zIndex: 90, width: "min(460px, calc(100vw - 32px))", maxHeight: "60vh", display: "flex", flexDirection: "column", background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 12, boxShadow: "0 12px 40px rgba(0,0,0,0.3)", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: "1px solid var(--color-border)" }}>
            <strong style={{ fontSize: 13 }}>デバッグパネル</strong>
            <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: "var(--color-primary)", color: "var(--color-primary-fg)" }}>DEV</span>
            <Button type="button" onClick={() => { try { localStorage.setItem("debug-panel-off", "1"); } catch { /* noop */ } setEnabled(false); }}
              style={{ marginLeft: "auto", fontSize: 11, cursor: "pointer", border: "none", background: "transparent", color: "var(--color-muted)" }}>このセッションで無効化</Button>
          </div>

          <div style={{ display: "flex", gap: 4, padding: "8px 12px 0", flexWrap: "wrap" }}>
            {TABS.map((t) => (
              <Button key={t.id} type="button" onClick={() => setTab(t.id)}
                style={{ fontSize: 12, padding: "4px 10px", borderRadius: 6, cursor: "pointer", border: "1px solid var(--color-border)", background: tab === t.id ? "var(--color-primary)" : "var(--color-bg)", color: tab === t.id ? "var(--color-primary-fg)" : "var(--color-fg)" }}>{t.label}</Button>
            ))}
          </div>

          <div style={{ padding: 12, overflowY: "auto", fontSize: 12.5 }}>
            {tab === "route" && (
              <table style={{ borderCollapse: "collapse", width: "100%" }}><tbody>
                <tr><th style={th}>pathname</th><td style={td}>{pathname}</td></tr>
                <tr><th style={th}>query</th><td style={td}>{query.length === 0 ? "（なし）" : query.map(([k, v]) => `${k}=${v}`).join(" & ")}</td></tr>
                <tr><th style={th}>referrer</th><td style={td}>{typeof document !== "undefined" && document.referrer ? document.referrer : "（なし）"}</td></tr>
              </tbody></table>
            )}

            {tab === "timing" && (timing ? (
              <table style={{ borderCollapse: "collapse", width: "100%" }}><tbody>
                <tr><th style={th}>DNS</th><td style={td}>{ms(timing.dns)}</td></tr>
                <tr><th style={th}>TCP</th><td style={td}>{ms(timing.tcp)}</td></tr>
                <tr><th style={th}>TTFB</th><td style={td}>{ms(timing.ttfb)}</td></tr>
                <tr><th style={th}>DOMContentLoaded</th><td style={td}>{ms(timing.dom)}</td></tr>
                <tr><th style={th}>Load</th><td style={td}>{ms(timing.load)}</td></tr>
              </tbody></table>
            ) : <div style={{ color: "var(--color-muted)" }}>Navigation Timing が取得できませんでした。</div>)}

            {tab === "storage" && (
              <div>
                <div style={{ color: "var(--color-muted)", marginBottom: 6 }}>localStorage：{storage.items.length} キー / 合計 {bytes(storage.total)}</div>
                {storage.items.length === 0 ? <div style={{ color: "var(--color-muted)" }}>（空）</div> : (
                  <table style={{ borderCollapse: "collapse", width: "100%" }}><tbody>
                    {storage.items.map((it) => (
                      <tr key={it.key}><td style={{ ...td, color: "var(--color-fg)" }}>{it.key}</td><td style={{ ...td, textAlign: "right", color: "var(--color-muted)", whiteSpace: "nowrap" }}>{bytes(it.size)}</td></tr>
                    ))}
                  </tbody></table>
                )}
              </div>
            )}

            {tab === "env" && (env ? (
              <table style={{ borderCollapse: "collapse", width: "100%" }}><tbody>
                <tr><th style={th}>NODE_ENV</th><td style={td}>{env.mode}</td></tr>
                <tr><th style={th}>viewport</th><td style={td}>{env.viewport}（DPR {env.dpr}）</td></tr>
                <tr><th style={th}>language</th><td style={td}>{env.language}</td></tr>
                <tr><th style={th}>online</th><td style={td}>{env.online ? "オンライン" : "オフライン"}</td></tr>
                <tr><th style={th}>userAgent</th><td style={{ ...td, fontSize: 11 }}>{env.ua}</td></tr>
              </tbody></table>
            ) : null)}

            {tab === "server" && (
              <div style={{ lineHeight: 1.8 }}>
                <p style={{ margin: "0 0 8px" }}>サーバ側で「1リクエストの中で何が起きたか」（SQL・外部API・AI呼び出しの本数と所要時間、<strong>N+1</strong>や遅いSQLの検知）は、基盤の <code>@platform/debug</code> が担当します。</p>
                <ul style={{ margin: 0, paddingLeft: 18, color: "var(--color-muted)" }}>
                  <li><code>createDebugCollector({"{"} enabled {"}"})</code> をアプリ起動時に1つ作る</li>
                  <li>API計装で <code>start / record / finish</code>、<code>summarize</code> と <code>findIssues</code> で要約</li>
                  <li>リクエスト単位で束ねる（<code>@platform/context</code> の requestId）・記録はメモリのみ</li>
                  <li><strong>本番は enabled:false</strong>（記録も保持もしない＝性能・メモリへの影響ゼロ）</li>
                </ul>
                <p style={{ margin: "8px 0 0", color: "var(--color-muted)" }}>このデモサイトはDBを持たないため、上のパネルはクライアント側で観測できる範囲を表示しています。</p>
              </div>
            )}
          </div>

          <div style={{ padding: "6px 12px", borderTop: "1px solid var(--color-border)", fontSize: 11, color: "var(--color-muted)" }}>
            本番ビルド（NODE_ENV=production）では自動的に非表示になります。
          </div>
        </div>
      )}
    </>
  );
}
