"use client";
/** メールボックス（受信箱）。届いたメール（アラート・内部連絡）の一覧・既読化・詳細、内部連絡の作成。 */
import * as React from "react";
import { Button, Input, Textarea } from "@platform/ui";

interface Message { id: string; owner: string; from: string; to: string; subject: string; body: string; sentAt: string; read: boolean; }

const fmt = (iso: string) => iso.replace("T", " ").slice(0, 16);

export interface MailboxClientProps { fetchImpl?: typeof fetch; }

export function MailboxClient({ fetchImpl }: MailboxClientProps) {
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [unread, setUnread] = React.useState(0);
  const [open, setOpen] = React.useState<Message | null>(null);
  const [composing, setComposing] = React.useState(false);
  const [form, setForm] = React.useState({ to: "", subject: "", body: "" });
  const [msg, setMsg] = React.useState("");
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;

  const reload = React.useCallback(async () => {
    const res = await doFetch("/api/mailbox");
    if (res.ok) { const d = (await res.json()) as { messages: Message[]; unread: number }; setMessages(d.messages); setUnread(d.unread); }
  }, [doFetch]);
  React.useEffect(() => { void reload(); }, [reload]);

  const openMessage = async (m: Message) => {
    setOpen(m);
    if (!m.read) { await doFetch("/api/mailbox/read", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: m.id }) }); await reload(); }
  };

  const send = async () => {
    setMsg("");
    if (!form.to || !form.subject) { setMsg("宛先と件名を入力してください"); return; }
    const res = await doFetch("/api/mailbox/send", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(form) });
    if (res.ok) { const d = (await res.json()) as { sent: number }; setMsg(`${d.sent} 件送信しました`); setForm({ to: "", subject: "", body: "" }); setComposing(false); await reload(); }
    else setMsg(((await res.json()) as { error?: string }).error ?? "送信に失敗しました");
  };

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">受信箱 {unread > 0 && <span className="ml-1 rounded-full bg-red-600 px-2 py-0.5 text-sm text-white">{unread}</span>}</h1>
        <Button onClick={() => setComposing((v) => !v)} className="rounded bg-neutral-900 px-4 py-2 text-sm text-white">{composing ? "閉じる" : "新規メッセージ"}</Button>
      </div>
      <p className="mb-4 text-xs text-neutral-500">運用アラートや内部連絡がここに届きます。宛先はメールアドレスです。</p>
      {msg && <p className="mb-3 rounded bg-neutral-100 px-3 py-2 text-sm text-neutral-700">{msg}</p>}

      {composing && (
        <div className="mb-6 rounded border border-neutral-200 p-4">
          <div className="flex flex-col gap-2">
            <label className="text-xs text-neutral-500">宛先（カンマ区切り可）<Input value={form.to} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, to: e.target.value })} placeholder="alice@example.com" className="mt-0.5 block w-full rounded border border-neutral-300 px-2 py-1 text-sm" /></label>
            <label className="text-xs text-neutral-500">件名<Input value={form.subject} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, subject: e.target.value })} className="mt-0.5 block w-full rounded border border-neutral-300 px-2 py-1 text-sm" /></label>
            <label className="text-xs text-neutral-500">本文<Textarea value={form.body} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setForm({ ...form, body: e.target.value })} rows={4} className="mt-0.5 block w-full rounded border border-neutral-300 px-2 py-1 text-sm" /></label>
            <Button onClick={send} className="self-start rounded bg-neutral-900 px-4 py-1.5 text-sm text-white">送信</Button>
          </div>
        </div>
      )}

      <div className="divide-y divide-neutral-100 rounded border border-neutral-200">
        {messages.map((m) => (
          <Button key={m.id} onClick={() => openMessage(m)} className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-neutral-50">
            <span className="min-w-0 flex-1">
              <span className={`block truncate text-sm ${m.read ? "text-neutral-700" : "font-semibold text-neutral-900"}`}>{!m.read && <span className="mr-1 inline-block h-2 w-2 rounded-full bg-blue-500"></span>}{m.subject}</span>
              <span className="block truncate text-xs text-neutral-500">{m.from}</span>
            </span>
            <span className="ml-3 shrink-0 text-xs text-neutral-400">{fmt(m.sentAt)}</span>
          </Button>
        ))}
        {messages.length === 0 && <p className="px-3 py-6 text-center text-sm text-neutral-500">受信メッセージはありません。</p>}
      </div>

      {open && (
        <div className="mt-6 rounded border border-neutral-200 p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-medium">{open.subject}</h2>
            <span className="flex gap-3">
              <Button onClick={() => { setComposing(true); setForm({ to: open.from, subject: open.subject.startsWith("Re:") ? open.subject : `Re: ${open.subject}`, body: `\n\n---- 元のメッセージ ----\n${open.body}` }); setOpen(null); }} className="text-xs text-blue-600 hover:underline">返信</Button>
              <Button onClick={() => setOpen(null)} className="text-xs text-neutral-500 hover:underline">閉じる</Button>
            </span>
          </div>
          <p className="text-xs text-neutral-500">差出人: {open.from} ／ 宛先: {open.to} ／ {fmt(open.sentAt)}</p>
          <p className="mt-3 whitespace-pre-wrap text-sm text-neutral-800">{open.body}</p>
        </div>
      )}
    </div>
  );
}
