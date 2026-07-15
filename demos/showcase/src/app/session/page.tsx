"use client";
/** セッション/クッキーのデモ。ログイン→セッション読み取り→ログアウト。 */
import { useEffect, useState } from "react";
import { Input, Button, toast } from "@platform/ui";

export default function Page() {
  const [email, setEmail] = useState("");
  const [me, setMe] = useState<{ email: string; loginAt: number } | null>(null);

  const refresh = async () => {
    const res = await fetch("/api/me");
    const data = await res.json();
    setMe(data.user);
  };
  useEffect(() => { void refresh(); }, []);

  const login = async () => {
    const res = await fetch("/api/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) });
    if (res.ok) { toast.success("ログインしました"); setEmail(""); await refresh(); }
    else toast.error("ログインに失敗しました");
  };
  const logout = async () => { await fetch("/api/logout", { method: "POST" }); toast.success("ログアウトしました"); await refresh(); };

  return (
    <main style={{ maxWidth: 460, margin: "3rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>セッション / クッキー</h1>
      <p style={{ color: "var(--color-muted)", marginBottom: "1rem" }}>
        封緘クッキーセッション(@platform/session)のデモ。ログインは5回/分でレート制限(@platform/guard)。保護ページは requireSession でガードします。
      </p>

      {me ? (
        <div style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius)", padding: "1rem" }}>
          <p>ログイン中: <strong>{me.email}</strong></p>
          <p style={{ fontSize: ".8rem", color: "var(--color-muted)" }}>ログイン時刻: {new Date(me.loginAt).toLocaleString("ja-JP")}</p>
          <Button variant="secondary" onClick={logout} className="mt-3">ログアウト</Button>
          <p style={{ marginTop: ".75rem" }}><a href="/dashboard">保護ページ(ダッシュボード)へ →</a></p>
        </div>
      ) : (
        <div style={{ display: "flex", gap: ".5rem" }}>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="メールアドレス" />
          <Button onClick={login}>ログイン</Button>
        </div>
      )}
      <p style={{ marginTop: "1.5rem" }}><a href="/">← 戻る</a></p>
    </main>
  );
}
