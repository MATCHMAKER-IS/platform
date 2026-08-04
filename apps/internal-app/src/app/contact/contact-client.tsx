"use client";
/** お問い合わせフォーム。送信すると受付され、担当（受信箱）にも通知される。InfoTip でカテゴリの補足を表示。 */
import * as React from "react";
import { Button, Input, Select, Textarea } from "@platform/ui";
import { InfoTip } from "../../components/InfoTip";

const CATEGORIES = ["請求・支払", "システム不具合", "アカウント", "その他"];

export interface ContactClientProps { fetchImpl?: typeof fetch; }

export function ContactClient({ fetchImpl }: ContactClientProps) {
  const [form, setForm] = React.useState({ name: "", email: "", category: CATEGORIES[0]!, subject: "", message: "" });
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState("");
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;

  const submit = async () => {
    setError("");
    if (!form.name || !form.email || !form.subject || !form.message) { setError("氏名・メール・件名・本文を入力してください"); return; }
    const res = await doFetch("/api/inquiries", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(form) });
    if (res.ok) setDone(true);
    else setError(((await res.json()) as { error?: string }).error ?? "送信に失敗しました");
  };

  if (done) return (
    <div className="mx-auto max-w-xl p-6">
      <div className="rounded border border-[color-mix(in_srgb,var(--color-success)_25%,transparent)] bg-[color-mix(in_srgb,var(--color-success)_8%,transparent)] p-6 text-center">
        <p className="text-lg font-medium text-[var(--color-success)]">お問い合わせを受け付けました</p>
        <p className="mt-2 text-sm text-[var(--color-success)]">担当者よりご連絡いたします。</p>
        <Button onClick={() => { setDone(false); setForm({ name: "", email: "", category: CATEGORIES[0]!, subject: "", message: "" }); }} className="mt-4 rounded border border-[var(--color-border)] px-4 py-2 text-sm">続けて問い合わせる</Button>
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-xl p-6">
      <h1 className="mb-1 text-2xl font-bold">お問い合わせ</h1>
      <p className="mb-4 text-xs text-[var(--color-muted)]">ご質問・不具合の報告などをお送りください。</p>
      {error && <p className="mb-3 rounded bg-[color-mix(in_srgb,var(--color-danger)_8%,transparent)] px-3 py-2 text-sm text-[var(--color-danger)]">{error}</p>}
      <div className="flex flex-col gap-3">
        <label className="text-sm">氏名<Input value={form.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, name: e.target.value })} className="mt-0.5 block w-full rounded border border-[var(--color-border)] px-2 py-1.5 text-sm" /></label>
        <label className="text-sm">メールアドレス<Input value={form.email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" className="mt-0.5 block w-full rounded border border-[var(--color-border)] px-2 py-1.5 text-sm" /></label>
        <label className="text-sm"><span className="inline-flex items-center gap-1">カテゴリ <InfoTip text="お問い合わせの種類を選ぶと、担当部署へ振り分けられます。急ぎの不具合は「システム不具合」を選んでください。" /></span>
          <Select
            value={form.category} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm({ ...form, category: e.target.value })} className="mt-0.5 block w-full rounded border border-[var(--color-border)] px-2 py-1.5 text-sm"
            options={[
              ...CATEGORIES.map((c) => ({ label: c, value: String(c) })),
            ]}
          />
        </label>
        <label className="text-sm">件名<Input value={form.subject} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, subject: e.target.value })} className="mt-0.5 block w-full rounded border border-[var(--color-border)] px-2 py-1.5 text-sm" /></label>
        <label className="text-sm">本文<Textarea value={form.message} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setForm({ ...form, message: e.target.value })} rows={6} className="mt-0.5 block w-full rounded border border-[var(--color-border)] px-2 py-1.5 text-sm" /></label>
        <Button onClick={submit} className="self-start rounded bg-[var(--color-fg)] px-6 py-2 text-sm text-white">送信する</Button>
      </div>
    </div>
  );
}
