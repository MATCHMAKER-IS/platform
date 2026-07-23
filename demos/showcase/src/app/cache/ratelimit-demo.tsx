"use client";
/**
 * レート制限のデモ（@platform/ratelimit 相当の挙動をローカルで再現）。
 * スライディングウィンドウ: 直近 window 秒に limit 回まで。超えると弾く（429 相当）。
 */
import * as React from "react";
import { Alert, Badge, Button, Input } from "@platform/ui";

const box: React.CSSProperties = { border: "1px solid var(--color-border)", borderRadius: "var(--radius)", background: "var(--color-surface)", padding: 16, marginBottom: 16 };
type Attempt = { at: number; ok: boolean };

export function RateLimitDemo() {
  const [limit, setLimit] = React.useState(5);
  const [windowSec, setWindowSec] = React.useState(10);
  const [hits, setHits] = React.useState<number[]>([]);
  const [log, setLog] = React.useState<Attempt[]>([]);
  const [, force] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => { const id = setInterval(force, 250); return () => clearInterval(id); }, []);

  const now = Date.now();
  const windowMs = windowSec * 1000;
  const active = hits.filter((t) => now - t < windowMs);
  const remaining = Math.max(0, limit - active.length);
  const resetInMs = active.length > 0 ? Math.max(0, active[0]! + windowMs - now) : 0;

  const attempt = () => {
    const t = Date.now();
    const act = hits.filter((x) => t - x < windowMs);
    const ok = act.length < limit;
    setHits(ok ? [...act, t] : act);
    setLog((l) => [{ at: t, ok }, ...l].slice(0, 12));
  };

  return (
    <>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 16 }}>レート制限（連打で発動）</h1>
      <div style={box}>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 14 }}>
          <label style={{ fontSize: 13 }}><span style={{ color: "var(--color-muted)", marginRight: 6 }}>上限（回）</span>
            <Input type="number" min={1} max={20} value={limit} onChange={(e) => { setLimit(Math.max(1, +e.target.value || 1)); setHits([]); }} style={inp} /></label>
          <label style={{ fontSize: 13 }}><span style={{ color: "var(--color-muted)", marginRight: 6 }}>ウィンドウ（秒）</span>
            <Input type="number" min={1} max={60} value={windowSec} onChange={(e) => { setWindowSec(Math.max(1, +e.target.value || 1)); setHits([]); }} style={inp} /></label>
        </div>
        <div style={{ textAlign: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 13, color: "var(--color-muted)", marginBottom: 4 }}>直近 {windowSec} 秒の残り</div>
          <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 8 }}>
            {Array.from({ length: limit }).map((_, i) => (<span key={i} style={{ width: 22, height: 22, borderRadius: 6, background: i < remaining ? "var(--color-primary)" : "var(--color-border)" }} />))}
          </div>
          <div style={{ fontSize: 13 }}>残り <strong>{remaining}</strong> / {limit} 回
            {remaining === 0 && resetInMs > 0 && <span style={{ color: "var(--color-danger)", marginLeft: 8 }}>あと {(resetInMs / 1000).toFixed(1)} 秒で回復</span>}</div>
        </div>
        <div style={{ textAlign: "center" }}><Button onClick={attempt} disabled={remaining === 0}>{remaining === 0 ? "制限中（429）" : "リクエスト送信"}</Button></div>
      </div>
      <div style={box}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>アクセスログ</div>
        {log.length === 0 ? (<div style={{ fontSize: 12, color: "var(--color-muted)" }}>ボタンを連打してみてください。上限を超えると弾かれます。</div>) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 4 }}>
            {log.map((a, i) => (<li key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
              <Badge variant={a.ok ? "success" : "danger"}>{a.ok ? "200 OK" : "429 制限"}</Badge>
              <span style={{ fontFamily: "monospace", color: "var(--color-muted)" }}>{new Date(a.at).toLocaleTimeString("ja-JP")}</span></li>))}
          </ul>)}
      </div>
      <Alert variant="info" title="実基盤では"><code>@platform/ratelimit</code> はストアを差し替え可能（開発はメモリ、本番・複数インスタンスは Redis）。ログイン試行や API 濫用の抑止に使い、<code>@platform/guard</code> がルート入口でこれを束ねます。</Alert>
    </>
  );
}
const inp: React.CSSProperties = { width: 60, padding: "4px 6px", borderRadius: "var(--radius)", border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-fg)" };
