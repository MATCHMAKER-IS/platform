"use client";
/** 見積管理。一覧（状態・残日数）、作成（明細入力）、状態遷移、請求書へ変換。 */
import * as React from "react";
import { Button, Input, Select } from "@platform/ui";

interface Line { description: string; quantity: number; unitPrice: number; taxRate?: 10 | 8 | 0; }
interface Totals { subtotal: number; tax: number; total: number; }
interface QuoteView { number: string; issueDate: string; validUntil: string; billTo: string; lines: Line[]; totals: Totals; state: string; status: string; daysLeft: number; }

const STATUS: Record<string, { label: string; cls: string }> = {
  draft: { label: "下書き", cls: "bg-neutral-100 text-neutral-700" },
  sent: { label: "送付済", cls: "bg-blue-100 text-blue-800" },
  accepted: { label: "受注", cls: "bg-green-100 text-green-800" },
  rejected: { label: "失注", cls: "bg-neutral-200 text-neutral-500" },
  expired: { label: "期限切れ", cls: "bg-red-100 text-red-800" },
};
const yen = (n: number) => `¥${n.toLocaleString()}`;

export interface QuotesClientProps { fetchImpl?: typeof fetch; canWrite?: boolean; }

export function QuotesClient({ fetchImpl, canWrite = true }: QuotesClientProps) {
  const [quotes, setQuotes] = React.useState<QuoteView[]>([]);
  const [creating, setCreating] = React.useState(false);
  const [header, setHeader] = React.useState({ number: "", billTo: "", issueDate: "", validUntil: "" });
  const [lines, setLines] = React.useState<Line[]>([{ description: "", quantity: 1, unitPrice: 0, taxRate: 10 }]);
  const [error, setError] = React.useState("");
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;

  const reload = React.useCallback(async () => {
    const res = await doFetch("/api/quotes");
    if (res.ok) setQuotes(((await res.json()) as { quotes: QuoteView[] }).quotes);
  }, [doFetch]);
  React.useEffect(() => { void reload(); }, [reload]);

  const setLine = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const preview = lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);

  const submit = async () => {
    setError("");
    if (!header.number || !header.billTo || !header.issueDate || !header.validUntil) { setError("番号・宛先・発行日・有効期限を入力してください"); return; }
    const clean = lines.filter((l) => l.description && l.quantity > 0);
    if (clean.length === 0) { setError("明細を 1 行以上入力してください"); return; }
    const res = await doFetch("/api/quotes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...header, lines: clean }) });
    if (res.ok) { setCreating(false); setHeader({ number: "", billTo: "", issueDate: "", validUntil: "" }); setLines([{ description: "", quantity: 1, unitPrice: 0, taxRate: 10 }]); await reload(); }
    else setError(((await res.json()) as { error?: string }).error ?? "作成に失敗しました");
  };

  const changeState = async (number: string, state: string) => {
    const res = await doFetch(`/api/quotes/${number}/state`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ state }) });
    if (res.ok) await reload();
  };

  const convert = async (q: QuoteView) => {
    const promptFn = (globalThis as unknown as { prompt: (m: string, d?: string) => string | null }).prompt;
    const invNumber = promptFn("請求書番号を入力してください", q.number.replace(/^Q/, "INV"));
    if (!invNumber) return;
    const today = new Date().toISOString().slice(0, 10);
    const due = promptFn("支払期限（YYYY-MM-DD）", today);
    if (!due) return;
    const res = await doFetch(`/api/quotes/${q.number}/convert`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ number: invNumber, issueDate: today, dueDate: due }) });
    if (res.ok) { await reload(); (globalThis as unknown as { alert: (m: string) => void }).alert(`請求書 ${invNumber} を作成しました`); }
    else setError(((await res.json()) as { error?: string }).error ?? "変換に失敗しました");
  };

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">見積</h1>
        {canWrite && <Button onClick={() => setCreating((v) => !v)} className="rounded bg-neutral-900 px-4 py-2 text-sm text-white">{creating ? "閉じる" : "新規作成"}</Button>}
      </div>
      {error && <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {creating && (
        <div className="mb-6 rounded border border-neutral-200 p-4">
          <div className="mb-3 grid gap-2 md:grid-cols-2">
            <Input value={header.number} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setHeader({ ...header, number: e.target.value })} placeholder="見積番号" className="rounded border border-neutral-300 px-2 py-1 text-sm" />
            <Input value={header.billTo} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setHeader({ ...header, billTo: e.target.value })} placeholder="宛先" className="rounded border border-neutral-300 px-2 py-1 text-sm" />
            <label className="text-xs text-neutral-500">発行日<Input type="date" value={header.issueDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setHeader({ ...header, issueDate: e.target.value })} className="mt-0.5 block w-full rounded border border-neutral-300 px-2 py-1 text-sm" /></label>
            <label className="text-xs text-neutral-500">有効期限<Input type="date" value={header.validUntil} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setHeader({ ...header, validUntil: e.target.value })} className="mt-0.5 block w-full rounded border border-neutral-300 px-2 py-1 text-sm" /></label>
          </div>
          <table className="mb-2 w-full text-sm">
            <thead><tr className="text-left text-xs text-neutral-500"><th className="px-1 py-1">摘要</th><th className="px-1 py-1 w-20">数量</th><th className="px-1 py-1 w-28">単価</th><th className="px-1 py-1 w-20">税率</th><th></th></tr></thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i}>
                  <td className="px-1 py-1"><Input value={l.description} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLine(i, { description: e.target.value })} className="w-full rounded border border-neutral-300 px-2 py-1" /></td>
                  <td className="px-1 py-1"><Input value={String(l.quantity)} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLine(i, { quantity: Number(e.target.value) || 0 })} inputMode="numeric" className="w-full rounded border border-neutral-300 px-2 py-1" /></td>
                  <td className="px-1 py-1"><Input value={String(l.unitPrice)} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLine(i, { unitPrice: Number(e.target.value) || 0 })} inputMode="numeric" className="w-full rounded border border-neutral-300 px-2 py-1" /></td>
                  <td className="px-1 py-1">
                    <Select value={String(l.taxRate ?? 10)} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setLine(i, { taxRate: Number(e.target.value) as 10 | 8 | 0 })} className="w-full rounded border border-neutral-300 px-1 py-1" options={[{ label: "10%", value: "10" }, { label: "8%", value: "8" }, { label: "0%", value: "0" }]} />
                  </td>
                  <td className="px-1 py-1">{lines.length > 1 && <Button aria-label="この明細行を削除" title="この明細行を削除" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} className="text-neutral-400">×</Button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between">
            <Button onClick={() => setLines((ls) => [...ls, { description: "", quantity: 1, unitPrice: 0, taxRate: 10 }])} className="text-sm text-blue-600">＋ 明細を追加</Button>
            <span className="text-sm text-neutral-500">税抜計 {yen(preview)}</span>
          </div>
          <Button onClick={submit} className="mt-3 rounded bg-neutral-900 px-4 py-2 text-sm text-white">見積を作成</Button>
        </div>
      )}

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
            <th className="px-2 py-1">番号</th><th className="px-2 py-1">宛先</th><th className="px-2 py-1">有効期限</th>
            <th className="px-2 py-1 text-right">合計</th><th className="px-2 py-1">状態</th><th className="px-2 py-1"></th>
          </tr>
        </thead>
        <tbody>
          {quotes.map((q) => (
            <tr key={q.number} className="border-b border-neutral-100">
              <td className="px-2 py-2 font-mono text-xs">{q.number}</td>
              <td className="px-2 py-2">{q.billTo}</td>
              <td className="px-2 py-2 text-xs text-neutral-500">{q.validUntil}{q.status !== "expired" && q.status !== "accepted" && q.daysLeft >= 0 && <span className="ml-1">（残{q.daysLeft}日）</span>}</td>
              <td className="px-2 py-2 text-right font-medium">{yen(q.totals.total)}</td>
              <td className="px-2 py-2"><span className={`rounded px-2 py-0.5 text-xs ${STATUS[q.status]?.cls ?? "bg-neutral-100"}`}>{STATUS[q.status]?.label ?? q.status}</span></td>
              <td className="px-2 py-2">
                {canWrite && (
                  <span className="flex gap-2 text-xs">
                    {q.state === "draft" && <Button onClick={() => changeState(q.number, "sent")} className="text-blue-600 hover:underline">送付</Button>}
                    {(q.state === "draft" || q.state === "sent") && q.status !== "expired" && <Button onClick={() => convert(q)} className="text-green-700 hover:underline">請求書化</Button>}
                    {q.state !== "rejected" && q.state !== "accepted" && <Button onClick={() => changeState(q.number, "rejected")} className="text-neutral-400 hover:underline">失注</Button>}
                  </span>
                )}
              </td>
            </tr>
          ))}
          {quotes.length === 0 && <tr><td colSpan={6} className="px-2 py-4 text-center text-sm text-neutral-500">見積がありません。</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
