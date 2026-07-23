"use client";
/** 公開サイトのお問い合わせフォーム。送信は /api/contact 経由で社内の受信一覧へ集約される。 */
import { useState, type ChangeEvent, type FormEvent } from "react";
import { Button, Input, Select, Textarea } from "@platform/ui";

const CATEGORIES = ["製品について", "料金・お見積り", "サポート", "採用", "その他"];

export function ContactClient() {
  const [form, setForm] = useState({ name: "", email: "", category: CATEGORIES[0]!, subject: "", message: "" });
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const set = (k: string) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.name || !form.email || !form.subject || !form.message) { setError("必須項目を入力してください。"); return; }
    setStatus("sending");
    try {
      const res = await fetch("/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (res.ok) { setStatus("done"); setForm({ name: "", email: "", category: CATEGORIES[0]!, subject: "", message: "" }); }
      else { setStatus("error"); setError((((await res.json()) as { error?: string }).error) ?? "送信に失敗しました。"); }
    } catch { setStatus("error"); setError("送信に失敗しました。時間をおいて再度お試しください。"); }
  };

  const inputStyle = { width: "100%", padding: ".5rem", border: "1px solid #ccc", borderRadius: 6, marginTop: ".25rem" } as const;

  if (status === "done") return <p style={{ padding: "1rem", background: "#ecfdf5", borderRadius: 8, color: "#065f46" }}>お問い合わせを受け付けました。ご連絡ありがとうございます。</p>;

  return (
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: ".75rem" }}>
      {error && <p style={{ color: "#b91c1c", fontSize: ".9rem" }}>{error}</p>}
      <label style={{ fontSize: ".85rem", color: "#444" }}>お名前 *<Input value={form.name} onChange={set("name")} style={inputStyle} /></label>
      <label style={{ fontSize: ".85rem", color: "#444" }}>メールアドレス *<Input type="email" value={form.email} onChange={set("email")} style={inputStyle} /></label>
      <label style={{ fontSize: ".85rem", color: "#444" }}>種別<Select value={form.category} onChange={set("category")} style={inputStyle} options={[...CATEGORIES.map((c) => ({ label: c, value: String(c) }))]} /></label>
      <label style={{ fontSize: ".85rem", color: "#444" }}>件名 *<Input value={form.subject} onChange={set("subject")} style={inputStyle} /></label>
      <label style={{ fontSize: ".85rem", color: "#444" }}>本文 *<Textarea value={form.message} onChange={set("message")} rows={6} style={inputStyle} /></label>
      <Button type="submit" disabled={status === "sending"} style={{ padding: ".6rem 1.2rem", background: "#111", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", alignSelf: "flex-start" }}>{status === "sending" ? "送信中…" : "送信する"}</Button>
    </form>
  );
}
