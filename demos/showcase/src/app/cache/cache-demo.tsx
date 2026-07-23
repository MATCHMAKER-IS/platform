"use client";
/**
 * キャッシュのデモ（@platform/cache 相当の挙動をローカルで再現）。
 * 初回ミス（遅い取得を模擬）、以降は TTL 内ならヒット（即時）。TTL 切れで再取得。
 */
import * as React from "react";
import { Badge, Button } from "@platform/ui";

const box: React.CSSProperties = { border: "1px solid var(--color-border)", borderRadius: "var(--radius)", background: "var(--color-surface)", padding: 16, marginBottom: 16 };
const KEYS = ["user:101", "user:102", "product:A", "product:B"];
const TTL_MS = 5000, FETCH_MS = 800;
type Entry = { expiresAt: number };
type LogItem = { key: string; kind: "HIT" | "MISS"; at: number };

export function CacheDemo() {
  const cache = React.useRef<Map<string, Entry>>(new Map());
  const [log, setLog] = React.useState<LogItem[]>([]);
  const [loading, setLoading] = React.useState<string | null>(null);
  const [stats, setStats] = React.useState({ hit: 0, miss: 0 });
  const [, force] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => { const id = setInterval(force, 300); return () => clearInterval(id); }, []);

  const get = (key: string) => {
    const now = Date.now();
    const e = cache.current.get(key);
    if (e && e.expiresAt > now) { setStats((s) => ({ ...s, hit: s.hit + 1 })); setLog((l) => [{ key, kind: "HIT" as const, at: now }, ...l].slice(0, 12)); return; }
    setLoading(key); setStats((s) => ({ ...s, miss: s.miss + 1 })); setLog((l) => [{ key, kind: "MISS" as const, at: now }, ...l].slice(0, 12));
    setTimeout(() => { cache.current.set(key, { expiresAt: Date.now() + TTL_MS }); setLoading(null); }, FETCH_MS);
  };

  const total = stats.hit + stats.miss;
  const rate = total === 0 ? 0 : Math.round((stats.hit / total) * 100);
  const now = Date.now();
  return (
    <>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 16 }}>キャッシュ（ヒット / ミス・TTL）</h1>
      <div style={box}>
        <div style={{ fontSize: 13, color: "var(--color-muted)", marginBottom: 10 }}>キーを取得（初回は遅い＝ミス、{TTL_MS / 1000}秒以内の再取得は即時＝ヒット）</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {KEYS.map((k) => {
            const e = cache.current.get(k);
            const cached = e !== undefined && e.expiresAt > now;
            const ttlLeft = cached ? ((e!.expiresAt - now) / 1000).toFixed(1) : null;
            return (
              <Button key={k} type="button" onClick={() => get(k)} disabled={loading === k}
                style={{ padding: "8px 12px", borderRadius: "var(--radius)", cursor: "pointer", border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-fg)", fontFamily: "monospace", fontSize: 12, textAlign: "left", minWidth: 130 }}>
                <div style={{ fontWeight: 700 }}>{k}</div>
                <div style={{ fontSize: 11, marginTop: 3 }}>
                  {loading === k ? <span style={{ color: "var(--color-warning, #d97706)" }}>取得中…</span>
                    : cached ? <span style={{ color: "var(--color-success, #16a34a)" }}>cached · あと {ttlLeft}s</span>
                      : <span style={{ color: "var(--color-muted)" }}>未キャッシュ</span>}</div>
              </Button>);
          })}
        </div>
      </div>
      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        {[{ label: "ヒット", v: String(stats.hit), c: "var(--color-success, #16a34a)" }, { label: "ミス", v: String(stats.miss), c: "var(--color-danger)" }, { label: "ヒット率", v: rate + "%", c: "var(--color-primary)" }].map((s) => (
          <div key={s.label} style={{ ...box, marginBottom: 0, flex: 1, minWidth: 120, textAlign: "center" }}>
            <div style={{ fontSize: 12, color: "var(--color-muted)" }}>{s.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: s.c }}>{s.v}</div></div>))}
      </div>
      <div style={box}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>操作ログ</div>
        {log.length === 0 ? (<div style={{ fontSize: 12, color: "var(--color-muted)" }}>同じキーを続けて押すとヒット、TTL 切れ後はまたミスになります。</div>) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 4 }}>
            {log.map((it, i) => (<li key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
              <Badge variant={it.kind === "HIT" ? "success" : "secondary"}>{it.kind}</Badge>
              <span style={{ fontFamily: "monospace" }}>{it.key}</span>
              <span style={{ color: "var(--color-muted)", marginLeft: "auto" }}>{new Date(it.at).toLocaleTimeString("ja-JP")}</span></li>))}
          </ul>)}
      </div>
      <Button size="sm" variant="secondary" onClick={() => { cache.current.clear(); setStats({ hit: 0, miss: 0 }); setLog([]); }}>キャッシュをクリア</Button>
      <p style={{ fontSize: 12, color: "var(--color-muted)", lineHeight: 1.8, marginTop: 12 }}>よく使う値を一時保存して、重い取得（DB・外部 API）を減らします。実基盤 <code>@platform/cache</code> は保存先を意識せず使え、失敗は Result で返します。</p>
    </>
  );
}
