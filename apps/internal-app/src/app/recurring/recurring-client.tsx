"use client";
/** 繰り返し請求（サブスク）。プラン一覧（次回請求日・課金要否）、作成、有効/停止、一括請求。 */
import * as React from "react";
import { Button, Input, Select } from "@platform/ui";

interface Line { description: string; quantity: number; unitPrice: number; taxRate?: 10 | 8 | 0; }
interface Totals { subtotal: number; tax: number; total: number; }
interface PlanView { number: string; billTo: string; interval: string; startDate: string; endDate?: string; lines: Line[]; lastBilled?: string; active: boolean; nextDate: string | null; due: boolean; }

const INTERVAL: Record<string, string> = { monthly: "毎月", quarterly: "四半期", yearly: "毎年" };
const yen = (n: number) => `¥${n.toLocaleString()}`;
const lineTotal = (ls: Line[]) => ls.reduce((s, l) => s + l.quantity * l.unitPrice, 0);

export interface RecurringClientProps { fetchImpl?: typeof fetch; canWrite?: boolean; }

export function RecurringClient({ fetchImpl, canWrite = true }: RecurringClientProps) {
  const [plans, setPlans] = React.useState<PlanView[]>([]);
  const [creating, setCreating] = React.useState(false);
  const [header, setHeader] = React.useState({ number: "", billTo: "", interval: "monthly", startDate: "" });
  const [lines, setLines] = React.useState<Line[]>([{ description: "", quantity: 1, unitPrice: 0, taxRate: 10 }]);
  const [error, setError] = React.useState("");
  const [message, setMessage] = React.useState("");
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;

  const reload = React.useCallback(async () => {
    const res = await doFetch("/api/recurring");
    if (res.ok) setPlans(((await res.json()) as { plans: PlanView[] }).plans);
  }, [doFetch]);
  React.useEffect(() => { void reload(); }, [reload]);

  const setLine = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  const submit = async () => {
    setError("");
    if (!header.number || !header.billTo || !header.startDate) { setError("番号・宛先・開始日を入力してください"); return; }
    const clean = lines.filter((l) => l.description && l.quantity > 0);
    if (clean.length === 0) { setError("明細を 1 行以上入力してください"); return; }
    const res = await doFetch("/api/recurring", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...header, lines: clean }) });
    if (res.ok) { setCreating(false); setHeader({ number: "", billTo: "", interval: "monthly", startDate: "" }); setLines([{ description: "", quantity: 1, unitPrice: 0, taxRate: 10 }]); await reload(); }
    else setError(((await res.json()) as { error?: string }).error ?? "作成に失敗しました");
  };

  const toggle = async (number: string, active: boolean) => {
    const res = await doFetch(`/api/recurring/${number}/toggle`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ active }) });
    if (res.ok) await reload();
  };

  const runBilling = async () => {
    setMessage("");
    const res = await doFetch("/api/recurring/run", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}) });
    if (res.ok) { const data = (await res.json()) as { created: string[] }; setMessage(data.created.length > 0 ? `${data.created.length} 件の請求書を作成しました：${data.created.join("、")}` : "課金対象のプランはありませんでした"); await reload(); }
  };

  const dueCount = plans.filter((p) => p.due).length;

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">繰り返し請求</h1>
        <div className="flex gap-2">
          {canWrite && dueCount > 0 && <Button onClick={runBilling} className="rounded bg-amber-600 px-4 py-2 text-sm text-white">課金対象を請求書化（{dueCount}）</Button>}
          {canWrite && <Button onClick={() => setCreating((v) => !v)} className="rounded bg-neutral-900 px-4 py-2 text-sm text-white">{creating ? "閉じる" : "新規作成"}</Button>}
        </div>
      </div>
      {error && <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {message && <p className="mb-3 rounded bg-green-50 px-3 py-2 text-sm text-green-700">{message}</p>}

      {creating && (
        <div className="mb-6 rounded border border-neutral-200 p-4">
          <div className="mb-3 grid gap-2 md:grid-cols-2">
            <Input value={header.number} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setHeader({ ...header, number: e.target.value })} placeholder="プラン番号（例 SUB-001）" className="rounded border border-neutral-300 px-2 py-1 text-sm" />
            <Input value={header.billTo} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setHeader({ ...header, billTo: e.target.value })} placeholder="宛先" className="rounded border border-neutral-300 px-2 py-1 text-sm" />
            <label className="text-xs text-neutral-500">周期
              <Select value={header.interval} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setHeader({ ...header, interval: e.target.value })} className="mt-0.5 block w-full rounded border border-neutral-300 px-2 py-1 text-sm" options={[{ label: "毎月", value: "monthly" }, { label: "四半期", value: "quarterly" }, { label: "毎年", value: "yearly" }]} />
            </label>
            <label className="text-xs text-neutral-500">開始日<Input type="date" value={header.startDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setHeader({ ...header, startDate: e.target.value })} className="mt-0.5 block w-full rounded border border-neutral-300 px-2 py-1 text-sm" /></label>
          </div>
          <table className="mb-2 w-full text-sm">
            <thead><tr className="text-left text-xs text-neutral-500"><th className="px-1 py-1">摘要</th><th className="px-1 py-1 w-20">数量</th><th className="px-1 py-1 w-28">単価</th><th className="px-1 py-1 w-20">税率</th><th></th></tr></thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i}>
                  <td className="px-1 py-1"><Input value={l.description} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLine(i, { description: e.target.value })} className="w-full rounded border border-neutral-300 px-2 py-1" /></td>
                  <td className="px-1 py-1"><Input value={String(l.quantity)} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLine(i, { quantity: Number(e.target.value) || 0 })} inputMode="numeric" className="w-full rounded border border-neutral-300 px-2 py-1" /></td>
                  <td className="px-1 py-1"><Input value={String(l.unitPrice)} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLine(i, { unitPrice: Number(e.target.value) || 0 })} inputMode="numeric" className="w-full rounded border border-neutral-300 px-2 py-1" /></td>
                  <td className="px-1 py-1"><Select value={String(l.taxRate ?? 10)} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setLine(i, { taxRate: Number(e.target.value) as 10 | 8 | 0 })} className="w-full rounded border border-neutral-300 px-1 py-1" options={[{ label: "10%", value: "10" }, { label: "8%", value: "8" }, { label: "0%", value: "0" }]} /></td>
                  <td className="px-1 py-1">{lines.length > 1 && <Button aria-label="この明細行を削除" title="この明細行を削除" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} className="text-neutral-400">×</Button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between">
            <Button onClick={() => setLines((ls) => [...ls, { description: "", quantity: 1, unitPrice: 0, taxRate: 10 }])} className="text-sm text-blue-600">＋ 明細を追加</Button>
            <span className="text-sm text-neutral-500">税抜計 {yen(lineTotal(lines))}</span>
          </div>
          <Button onClick={submit} className="mt-3 rounded bg-neutral-900 px-4 py-2 text-sm text-white">プランを作成</Button>
        </div>
      )}

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
            <th className="px-2 py-1">番号</th><th className="px-2 py-1">宛先</th><th className="px-2 py-1">周期</th>
            <th className="px-2 py-1 text-right">金額(税抜)</th><th className="px-2 py-1">次回請求</th><th className="px-2 py-1">状態</th><th className="px-2 py-1"></th>
          </tr>
        </thead>
        <tbody>
          {plans.map((p) => (
            <tr key={p.number} className="border-b border-neutral-100">
              <td className="px-2 py-2 font-mono text-xs">{p.number}</td>
              <td className="px-2 py-2">{p.billTo}</td>
              <td className="px-2 py-2 text-xs">{INTERVAL[p.interval] ?? p.interval}</td>
              <td className="px-2 py-2 text-right">{yen(lineTotal(p.lines))}</td>
              <td className="px-2 py-2 text-xs">{p.nextDate ?? "—"}{p.due && <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-amber-800">要請求</span>}</td>
              <td className="px-2 py-2">{p.active ? <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-800">有効</span> : <span className="rounded bg-neutral-200 px-2 py-0.5 text-xs text-neutral-500">停止</span>}</td>
              <td className="px-2 py-2">{canWrite && <Button onClick={() => toggle(p.number, !p.active)} className="text-xs text-blue-600 hover:underline">{p.active ? "停止" : "再開"}</Button>}</td>
            </tr>
          ))}
          {plans.length === 0 && <tr><td colSpan={7} className="px-2 py-4 text-center text-sm text-neutral-500">プランがありません。</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
