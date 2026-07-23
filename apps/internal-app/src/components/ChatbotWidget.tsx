"use client";
/** 右下に常駐するヘルプ・チャットボット。質問を投げると関連画面リンクつきの回答を返す。 */
import * as React from "react";
import { Button, Input } from "@platform/ui";

interface BotLink { label: string; href: string; }
interface Turn { role: "user" | "bot"; text: string; links?: BotLink[]; escalate?: boolean; }

export interface ChatbotWidgetProps { fetchImpl?: typeof fetch; }

export function ChatbotWidget({ fetchImpl }: ChatbotWidgetProps) {
  const [open, setOpen] = React.useState(false);
  const [input, setInput] = React.useState("");
  const [lastQuestion, setLastQuestion] = React.useState("");
  const [escalating, setEscalating] = React.useState(false);
  const [contact, setContact] = React.useState({ name: "", email: "" });
  const [sentInquiry, setSentInquiry] = React.useState(false);
  const [turns, setTurns] = React.useState<Turn[]>([{ role: "bot", text: "こんにちは。使い方について何でも聞いてください（例: 請求書の作り方、経費の取込、承認の流れ）。", links: [] }]);
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;

  const send = async () => {
    const message = input.trim();
    if (!message) return;
    setTurns((t) => [...t, { role: "user", text: message }]);
    setInput(""); setLastQuestion(message); setSentInquiry(false); setEscalating(false);
    const res = await doFetch("/api/chatbot", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message }) });
    if (res.ok) { const d = (await res.json()) as { reply: string; links: BotLink[]; escalate: boolean }; setTurns((t) => [...t, { role: "bot", text: d.reply, links: d.links, escalate: d.escalate }]); }
    else setTurns((t) => [...t, { role: "bot", text: "すみません、うまく応答できませんでした。" }]);
  };

  const submitInquiry = async () => {
    if (!contact.name || !contact.email) return;
    const res = await doFetch("/api/inquiries", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: contact.name, email: contact.email, category: "チャットボット", subject: lastQuestion.slice(0, 40) || "お問い合わせ", message: lastQuestion }) });
    if (res.ok) { setSentInquiry(true); setEscalating(false); setTurns((t) => [...t, { role: "bot", text: "担当者に転送しました。折り返しご連絡します。" }]); }
  };

  return (
    <div className="fixed bottom-4 right-4 z-40">
      {open && (
        <div className="mb-2 flex h-96 w-80 flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-neutral-100 bg-neutral-900 px-3 py-2 text-white">
            <span className="text-sm font-medium">ヘルプボット</span>
            <Button onClick={() => setOpen(false)} aria-label="閉じる" className="text-neutral-300 hover:text-white">×</Button>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto p-3">
            {turns.map((t, i) => (
              <div key={i} className={t.role === "user" ? "text-right" : "text-left"}>
                <span className={`inline-block max-w-[85%] rounded-lg px-3 py-1.5 text-sm ${t.role === "user" ? "bg-blue-600 text-white" : "bg-neutral-100 text-neutral-800"}`}>{t.text}</span>
                {t.links && t.links.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {t.links.map((l, j) => <a key={j} href={l.href} className="rounded border border-neutral-300 px-2 py-0.5 text-xs text-blue-600 hover:bg-neutral-50">{l.label}</a>)}
                  </div>
                )}
                {t.role === "bot" && t.escalate && !sentInquiry && (
                  <div className="mt-1">
                    {!escalating ? (
                      <Button onClick={() => setEscalating(true)} className="rounded border border-amber-400 bg-amber-50 px-2 py-0.5 text-xs text-amber-800 hover:bg-amber-100">担当者に問い合わせる</Button>
                    ) : (
                      <div className="mt-1 flex flex-col gap-1 rounded border border-neutral-200 p-2 text-left">
                        <Input value={contact.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setContact({ ...contact, name: e.target.value })} placeholder="お名前" className="rounded border border-neutral-300 px-2 py-1 text-xs" />
                        <Input value={contact.email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setContact({ ...contact, email: e.target.value })} placeholder="メールアドレス" className="rounded border border-neutral-300 px-2 py-1 text-xs" />
                        <Button onClick={submitInquiry} className="self-start rounded bg-neutral-900 px-2 py-1 text-xs text-white">この質問を担当者に送る</Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-2 border-t border-neutral-100 p-2">
            <Input value={input} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInput(e.target.value)} onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === "Enter") void send(); }} placeholder="質問を入力…" className="flex-1 rounded border border-neutral-300 px-2 py-1 text-sm" />
            <Button onClick={send} className="rounded bg-neutral-900 px-3 py-1 text-sm text-white">送信</Button>
          </div>
        </div>
      )}
      <Button onClick={() => setOpen((v) => !v)} className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-900 text-xl text-white shadow-lg hover:bg-neutral-800" aria-label="ヘルプボットを開く">{open ? "×" : "?"}</Button>
    </div>
  );
}
