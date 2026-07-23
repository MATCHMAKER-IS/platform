"use client";
/**
 * 問い合わせフォーム画面。@platform/ui の Button を使い、API を叩く。
 * 検証・受付・メール・一覧・Excel は API 側(基盤利用)で処理する。
 */
import { useEffect, useState } from "react";
import { Button, Input, Textarea } from "@platform/ui";

interface Row { id: string; name: string; email: string; message: string; createdAtJst: string }

export function InquiriesDemo() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/inquiries");
    const data = await res.json();
    setRows(data.inquiries ?? []);
  }
  useEffect(() => { void load(); }, []);

  async function submit() {
    setError(null); setOk(null);
    const res = await fetch("/api/inquiries", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error?.message ?? "エラー"); return; }
    setOk(`受け付けました(${data.receivedAt})。確認メールをメモリ送信しました。`);
    setForm({ name: "", email: "", message: "" });
    void load();
  }

  const field = { display: "block", width: "100%", marginTop: ".25rem", padding: ".5rem",
    border: "1px solid var(--color-border)", borderRadius: "var(--radius)" } as const;

  return (
    <>
      <h1 style={{ fontSize: "1.4rem", fontWeight: 700 }}>問い合わせフォーム</h1>
      <p style={{ color: "var(--color-muted)" }}>
        入力検証(validation)→ 受付 → 確認メール(mail・メモリ)→ 一覧(datetime)→ Excel(xlsx)。
      </p>

      <div style={{ marginTop: "1rem", display: "grid", gap: ".75rem" }}>
        <label>氏名<Input style={field} value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
        <label>メール<Input style={field} value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
        <label>本文<Textarea style={{ ...field, minHeight: 80 }} value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })} /></label>
        {error && <div style={{ color: "var(--color-danger)" }}>{error}</div>}
        {ok && <div style={{ color: "var(--color-primary)" }}>{ok}</div>}
        <div style={{ display: "flex", gap: ".5rem" }}>
          <Button onClick={submit}>送信する</Button>
          <a href="/api/inquiries/export"><Button variant="secondary">Excel 出力</Button></a>
        </div>
      </div>

      <h2 style={{ fontSize: "1.1rem", fontWeight: 600, marginTop: "2rem" }}>受付一覧</h2>
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: ".5rem", fontSize: ".9rem" }}>
        <thead><tr>
          {["氏名", "メール", "本文", "受付日時(JST)"].map((h) => (
            <th key={h} style={{ textAlign: "left", borderBottom: "1px solid var(--color-border)", padding: ".4rem" }}>{h}</th>
          ))}
        </tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td style={{ padding: ".4rem", borderBottom: "1px solid #f1f5f9" }}>{r.name}</td>
              <td style={{ padding: ".4rem", borderBottom: "1px solid #f1f5f9" }}>{r.email}</td>
              <td style={{ padding: ".4rem", borderBottom: "1px solid #f1f5f9" }}>{r.message}</td>
              <td style={{ padding: ".4rem", borderBottom: "1px solid #f1f5f9" }}>{r.createdAtJst}</td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={4} style={{ padding: ".75rem", color: "var(--color-muted)" }}>まだありません</td></tr>}
        </tbody>
      </table>
    </>
  );
}
