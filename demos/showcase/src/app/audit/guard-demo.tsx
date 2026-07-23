"use client";
/**
 * ルートガードのデモ（@platform/guard 相当の判定をローカルで再現）。
 * セッション（ログイン）＋ロール（RBAC）＋レート制限を束ね、ルート入口で許可/拒否する。
 */
import * as React from "react";
import { Alert, Badge, Button, Checkbox, Select } from "@platform/ui";

const box: React.CSSProperties = { border: "1px solid var(--color-border)", borderRadius: "var(--radius)", background: "var(--color-surface)", padding: 16, marginBottom: 16 };
type Role = "guest" | "member" | "admin";
type Route = { path: string; needSession: boolean; needRole: Role | null; label: string };
const ROUTES: Route[] = [
  { path: "/", needSession: false, needRole: null, label: "トップ（誰でも）" },
  { path: "/mypage", needSession: true, needRole: null, label: "マイページ（要ログイン）" },
  { path: "/admin", needSession: true, needRole: "admin", label: "管理画面（要 admin）" },
];
const RANK: Record<Role, number> = { guest: 0, member: 1, admin: 2 };

export function GuardDemo() {
  const [loggedIn, setLoggedIn] = React.useState(false);
  const [role, setRole] = React.useState<Role>("member");
  const [result, setResult] = React.useState<{ ok: boolean; code: number; msg: string } | null>(null);

  const access = (r: Route) => {
    if (r.needSession && !loggedIn) return setResult({ ok: false, code: 401, msg: `${r.path} → 401 未認証（ログインが必要）` });
    if (r.needRole && (!loggedIn || RANK[role] < RANK[r.needRole])) return setResult({ ok: false, code: 403, msg: `${r.path} → 403 権限不足（${r.needRole} が必要）` });
    setResult({ ok: true, code: 200, msg: `${r.path} → 200 OK（アクセス許可）` });
  };

  return (
    <>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 16 }}>ルートガード（認証・権限）</h1>
      <div style={box}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>現在の状態</div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
          <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
            <Checkbox  checked={loggedIn} onCheckedChange={(v) => setLoggedIn(!!v)} />ログイン中</label>
          <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>ロール:
            <Select value={role} onChange={(e) => setRole(e.target.value as Role)} disabled={!loggedIn}
              style={{ padding: "4px 8px", borderRadius: "var(--radius)", border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-fg)" }} options={[{ label: "member", value: "member" }, { label: "admin", value: "admin" }]} /></label>
          <span style={{ marginLeft: "auto" }}>{loggedIn ? <Badge variant="success">認証済み（{role}）</Badge> : <Badge variant="secondary">未ログイン</Badge>}</span>
        </div>
      </div>
      <div style={box}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>ルートにアクセス</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {ROUTES.map((r) => (<div key={r.path} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Button size="sm" variant="secondary" onClick={() => access(r)}><code style={{ fontFamily: "monospace" }}>{r.path}</code></Button>
            <span style={{ fontSize: 12, color: "var(--color-muted)" }}>{r.label}</span></div>))}
        </div>
        {result && (<div style={{ marginTop: 14, padding: 12, borderRadius: "var(--radius)", border: "1px solid var(--color-border)", background: result.ok ? "var(--color-bg)" : "var(--color-bg)", display: "flex", alignItems: "center", gap: 8 }}>
          <Badge variant={result.ok ? "success" : "danger"}>{result.code}</Badge><span style={{ fontSize: 13 }}>{result.msg}</span></div>)}
      </div>
      <Alert variant="info" title="実基盤では"><code>@platform/guard</code> が <code>requireSession</code> / <code>requireRole</code> / <code>requirePermission</code> を提供し、セッション（session）・RBAC（auth）・レート制限（ratelimit）を Route ハンドラの入口で束ねます。</Alert>
    </>
  );
}
