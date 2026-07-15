"use client";
/** 請求書管理。一覧（入金状況つき）、作成（明細入力）、入金記録。 */
import * as React from "react";

interface Line { description: string; quantity: number; unitPrice: number; taxRate?: 10 | 8 | 0; }
interface Totals { subtotal: number; tax: number; total: number; }
interface InvoiceView { number: string; issueDate: string; dueDate: string; billTo: string; registrationNumber?: string; lines: Line[]; totals: Totals; issued: boolean; paidAmount: number; cancelled: boolean; status: string; balance: number; }

const STATUS: Record<string, { label: string; cls: string }> = {
  issued: { label: "発行済", cls: "bg-blue-100 text-blue-800" },
  overdue: { label: "期限超過", cls: "bg-red-100 text-red-800" },
  paid: { label: "入金済", cls: "bg-green-100 text-green-800" },
  draft: { label: "下書き", cls: "bg-neutral-100 text-neutral-700" },
  cancelled: { label: "取消", cls: "bg-neutral-200 text-neutral-500" },
};

const yen = (n: number) => `¥${n.toLocaleString()}`;

interface Aging { current: number; d1_30: number; d31_60: number; d61_90: number; over90: number; total: number; }
interface DunningItem { number: string; billTo: string; dueDate: string; amountDue: number; overdueDays: number; level: string; message: string; }
interface Receivables { aging: Aging; outstanding: number; dunning: DunningItem[]; }
const DUNNING_LABEL: Record<string, string> = { reminder: "リマインド", first: "一次督促", second: "二次督促", final: "最終督促" };

export interface InvoicesClientProps { fetchImpl?: typeof fetch; canWrite?: boolean; }

export function InvoicesClient({ fetchImpl, canWrite = true }: InvoicesClientProps) {
  const [invoices, setInvoices] = React.useState<InvoiceView[]>([]);
  const [creating, setCreating] = React.useState(false);
  const [header, setHeader] = React.useState({ number: "", billTo: "", issueDate: "", dueDate: "", registrationNumber: "" });
  const [customers, setCustomers] = React.useState<{ code: string; name: string }[]>([]);
  const [approvals, setApprovals] = React.useState<Record<string, { status: string; currentStep: number; totalSteps: number }>>({});
  const [lines, setLines] = React.useState<Line[]>([{ description: "", quantity: 1, unitPrice: 0, taxRate: 10 }]);
  const [error, setError] = React.useState("");
  const [rcv, setRcv] = React.useState<Receivables | null>(null);
  const [dunningOpen, setDunningOpen] = React.useState<DunningItem | null>(null);
  const [approvalMsg, setApprovalMsg] = React.useState("");
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;

  const reload = React.useCallback(async () => {
    const cust = await doFetch("/api/partners?kind=customer");
    if (cust.ok) setCustomers(((await cust.json()) as { partners: { code: string; name: string }[] }).partners);
    const appr = await doFetch("/api/approvals/status?docType=invoice");
    if (appr.ok) setApprovals(((await appr.json()) as { statuses: Record<string, { status: string; currentStep: number; totalSteps: number }> }).statuses);
    const res = await doFetch("/api/invoices");
    if (res.ok) setInvoices(((await res.json()) as { invoices: InvoiceView[] }).invoices);
    const r2 = await doFetch("/api/receivables");
    if (r2.ok) setRcv((await r2.json()) as Receivables);
  }, [doFetch]);

  React.useEffect(() => { void reload(); }, [reload]);

  const setLine = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const preview = lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);

  const submit = async () => {
    setError("");
    if (!header.number || !header.billTo || !header.issueDate || !header.dueDate) { setError("番号・宛先・発行日・支払期限を入力してください"); return; }
    const clean = lines.filter((l) => l.description && l.quantity > 0);
    if (clean.length === 0) { setError("明細を 1 行以上入力してください"); return; }
    const res = await doFetch("/api/invoices", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...header, registrationNumber: header.registrationNumber || undefined, lines: clean }) });
    if (res.ok) { setCreating(false); setHeader({ number: "", billTo: "", issueDate: "", dueDate: "", registrationNumber: "" }); setLines([{ description: "", quantity: 1, unitPrice: 0, taxRate: 10 }]); await reload(); }
    else setError(((await res.json()) as { error?: string }).error ?? "作成に失敗しました");
  };

  const pay = async (number: string) => {
    const input = (globalThis as unknown as { prompt: (m: string) => string | null }).prompt("入金額を入力してください");
    const amount = Number(input);
    if (!input || Number.isNaN(amount) || amount <= 0) return;
    const res = await doFetch(`/api/invoices/${number}/receipt`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ amount }) });
    if (res.ok) await reload();
  };

  const submitApproval = async (number: string, amount: number) => {
    setApprovalMsg("");
    const res = await doFetch("/api/approvals/submit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ docType: "invoice", docNumber: number, amount }) });
    if (res.ok) { const d = (await res.json()) as { totalSteps: number }; setApprovalMsg(`${number} を承認申請しました（${d.totalSteps}段）`); }
    else setApprovalMsg(((await res.json()) as { error?: string }).error ?? "申請に失敗しました");
  };

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">請求書</h1>
        {canWrite && <button onClick={() => setCreating((v) => !v)} className="rounded bg-neutral-900 px-4 py-2 text-sm text-white">{creating ? "閉じる" : "新規作成"}</button>}
      </div>
      {error && <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {rcv && rcv.outstanding > 0 && (
        <div className="mb-6 rounded border border-neutral-200 p-4">
          <h2 className="mb-2 text-sm font-medium">売掛金エイジング（未収 {yen(rcv.outstanding)}）</h2>
          <div className="grid grid-cols-5 gap-2 text-center text-xs">
            <div className="rounded bg-neutral-50 p-2"><div className="text-neutral-500">期限前</div><div className="font-medium">{yen(rcv.aging.current)}</div></div>
            <div className="rounded bg-amber-50 p-2"><div className="text-amber-700">1〜30日</div><div className="font-medium">{yen(rcv.aging.d1_30)}</div></div>
            <div className="rounded bg-amber-100 p-2"><div className="text-amber-800">31〜60日</div><div className="font-medium">{yen(rcv.aging.d31_60)}</div></div>
            <div className="rounded bg-red-50 p-2"><div className="text-red-700">61〜90日</div><div className="font-medium">{yen(rcv.aging.d61_90)}</div></div>
            <div className="rounded bg-red-100 p-2"><div className="text-red-800">90日超</div><div className="font-medium">{yen(rcv.aging.over90)}</div></div>
          </div>
          {rcv.dunning.length > 0 && (
            <div className="mt-3">
              <h3 className="mb-1 text-xs font-medium text-neutral-600">督促対象 {rcv.dunning.length} 件</h3>
              <ul className="space-y-1 text-xs">
                {rcv.dunning.map((d) => (
                  <li key={d.number} className="flex items-center justify-between">
                    <span><span className="rounded bg-red-100 px-1.5 py-0.5 text-red-800">{DUNNING_LABEL[d.level] ?? d.level}</span> {d.number}・{d.billTo}（{d.overdueDays}日超過・{yen(d.amountDue)}）</span>
                    <button onClick={() => setDunningOpen(d)} className="text-blue-600 hover:underline">文面</button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {dunningOpen && (
        <div className="mb-6 rounded border border-neutral-300 p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium">督促文面（{dunningOpen.number}）</span>
            <button onClick={() => setDunningOpen(null)} className="text-xs text-neutral-500">閉じる</button>
          </div>
          <pre className="whitespace-pre-wrap rounded bg-neutral-50 p-3 text-xs leading-relaxed">{dunningOpen.message}</pre>
        </div>
      )}

      {creating && (
        <div className="mb-6 rounded border border-neutral-200 p-4">
          <div className="mb-3 grid gap-2 md:grid-cols-2">
            <input value={header.number} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setHeader({ ...header, number: e.target.value })} placeholder="請求書番号" className="rounded border border-neutral-300 px-2 py-1 text-sm" />
            {customers.length > 0 && (
              <select value="" onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { const c = customers.find((x) => x.code === e.target.value); if (c) setHeader({ ...header, billTo: c.name }); }} className="rounded border border-neutral-300 px-2 py-1 text-sm">
                <option value="">取引先から選択…</option>
                {customers.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
              </select>
            )}
            <input value={header.billTo} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setHeader({ ...header, billTo: e.target.value })} placeholder="宛先" className="rounded border border-neutral-300 px-2 py-1 text-sm" />
            <label className="text-xs text-neutral-500">発行日<input type="date" value={header.issueDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setHeader({ ...header, issueDate: e.target.value })} className="mt-0.5 block w-full rounded border border-neutral-300 px-2 py-1 text-sm" /></label>
            <label className="text-xs text-neutral-500">支払期限<input type="date" value={header.dueDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setHeader({ ...header, dueDate: e.target.value })} className="mt-0.5 block w-full rounded border border-neutral-300 px-2 py-1 text-sm" /></label>
            <input value={header.registrationNumber} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setHeader({ ...header, registrationNumber: e.target.value })} placeholder="登録番号 T+13桁（任意）" className="rounded border border-neutral-300 px-2 py-1 text-sm md:col-span-2" />
          </div>
          <table className="mb-2 w-full text-sm">
            <thead><tr className="text-left text-xs text-neutral-500"><th className="px-1 py-1">摘要</th><th className="px-1 py-1 w-20">数量</th><th className="px-1 py-1 w-28">単価</th><th className="px-1 py-1 w-20">税率</th><th></th></tr></thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i}>
                  <td className="px-1 py-1"><input value={l.description} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLine(i, { description: e.target.value })} className="w-full rounded border border-neutral-300 px-2 py-1" /></td>
                  <td className="px-1 py-1"><input value={String(l.quantity)} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLine(i, { quantity: Number(e.target.value) || 0 })} inputMode="numeric" className="w-full rounded border border-neutral-300 px-2 py-1" /></td>
                  <td className="px-1 py-1"><input value={String(l.unitPrice)} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLine(i, { unitPrice: Number(e.target.value) || 0 })} inputMode="numeric" className="w-full rounded border border-neutral-300 px-2 py-1" /></td>
                  <td className="px-1 py-1">
                    <select value={String(l.taxRate ?? 10)} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setLine(i, { taxRate: Number(e.target.value) as 10 | 8 | 0 })} className="w-full rounded border border-neutral-300 px-1 py-1">
                      <option value="10">10%</option><option value="8">8%</option><option value="0">0%</option>
                    </select>
                  </td>
                  <td className="px-1 py-1">{lines.length > 1 && <button onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} className="text-neutral-400">×</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between">
            <button onClick={() => setLines((ls) => [...ls, { description: "", quantity: 1, unitPrice: 0, taxRate: 10 }])} className="text-sm text-blue-600">＋ 明細を追加</button>
            <span className="text-sm text-neutral-500">税抜計 {yen(preview)}</span>
          </div>
          <button onClick={submit} className="mt-3 rounded bg-neutral-900 px-4 py-2 text-sm text-white">請求書を作成</button>
        </div>
      )}

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
            <th className="px-2 py-1">番号</th><th className="px-2 py-1">宛先</th><th className="px-2 py-1">支払期限</th>
            <th className="px-2 py-1 text-right">合計</th><th className="px-2 py-1 text-right">残高</th><th className="px-2 py-1">状態</th><th className="px-2 py-1"></th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv) => (
            <tr key={inv.number} className="border-b border-neutral-100">
              <td className="px-2 py-2 font-mono text-xs">{inv.number}</td>
              <td className="px-2 py-2">{inv.billTo}{(() => { const a = approvals[inv.number]; if (!a) return canWrite ? <button onClick={() => submitApproval(inv.number, inv.totals.total)} className="ml-2 text-xs text-blue-600 hover:underline">承認申請</button> : null; const label = a.status === "approved" ? "承認済" : a.status === "rejected" ? "却下" : `承認待ち ${a.currentStep}/${a.totalSteps}`; const cls = a.status === "approved" ? "bg-green-100 text-green-800" : a.status === "rejected" ? "bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800"; return <span className={`ml-2 rounded px-1.5 py-0.5 text-xs ${cls}`}>{label}</span>; })()}</td>
              <td className="px-2 py-2 text-xs text-neutral-500">{inv.dueDate}</td>
              <td className="px-2 py-2 text-right font-medium">{yen(inv.totals.total)}</td>
              <td className="px-2 py-2 text-right">{yen(inv.balance)}</td>
              <td className="px-2 py-2"><span className={`rounded px-2 py-0.5 text-xs ${STATUS[inv.status]?.cls ?? "bg-neutral-100"}`}>{STATUS[inv.status]?.label ?? inv.status}</span></td>
              <td className="px-2 py-2">
                <span className="flex gap-3">
                  <a href={`/api/invoices/${inv.number}/html`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">HTML</a>
                  <a href={`/api/invoices/${inv.number}/pdf`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">PDF</a>
                  {canWrite && <button onClick={() => submitApproval(inv.number, inv.totals.total)} className="text-blue-600 hover:underline">承認申請</button>}
                  {canWrite && !inv.cancelled && inv.balance > 0 && <button onClick={() => pay(inv.number)} className="text-blue-600 hover:underline">入金記録</button>}
                </span>
              </td>
            </tr>
          ))}
          {invoices.length === 0 && <tr><td colSpan={7} className="px-2 py-4 text-center text-sm text-neutral-500">請求書がありません。</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
