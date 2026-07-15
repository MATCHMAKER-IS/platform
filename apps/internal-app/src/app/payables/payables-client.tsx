"use client";
/** 買掛金。エイジング（5区分）、支払予定一覧、発注への支払記録。 */
import * as React from "react";

interface Aging { current: number; d1_30: number; d31_60: number; d61_90: number; over90: number; total: number; }
interface Due { number: string; supplier: string; dueDate: string; amountDue: number; overdueDays: number; }
interface Summary { aging: Aging; outstanding: number; upcoming: Due[]; }

const yen = (n: number) => `¥${n.toLocaleString()}`;

export interface PayablesClientProps { fetchImpl?: typeof fetch; canPay?: boolean; }

export function PayablesClient({ fetchImpl, canPay = true }: PayablesClientProps) {
  const [summary, setSummary] = React.useState<Summary | null>(null);
  const [error, setError] = React.useState("");
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;

  const reload = React.useCallback(async () => {
    const res = await doFetch("/api/payables");
    if (res.ok) setSummary((await res.json()) as Summary);
  }, [doFetch]);
  React.useEffect(() => { void reload(); }, [reload]);

  const pay = async (d: Due) => {
    setError("");
    const input = (globalThis as unknown as { prompt: (m: string, def?: string) => string | null }).prompt(`${d.supplier}（${d.number}）への支払額`, String(d.amountDue));
    const amount = Number(input);
    if (!input || Number.isNaN(amount) || amount <= 0) return;
    const res = await doFetch(`/api/payables/${d.number}/payment`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ amount }) });
    if (res.ok) await reload();
    else setError(((await res.json()) as { error?: string }).error ?? "支払記録に失敗しました");
  };

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="mb-1 text-2xl font-bold">買掛金</h1>
      <p className="mb-4 text-xs text-neutral-500">発注に対する未払と支払予定です。支払を記録すると未払残に反映されます。</p>
      {error && <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {summary && (
        <>
          <div className="mb-6 rounded border border-neutral-200 p-4">
            <h2 className="mb-2 text-sm font-medium">買掛金エイジング（未払 {yen(summary.outstanding)}）</h2>
            <div className="grid grid-cols-5 gap-2 text-center text-xs">
              <div className="rounded bg-neutral-50 p-2"><div className="text-neutral-500">期限前</div><div className="font-medium">{yen(summary.aging.current)}</div></div>
              <div className="rounded bg-amber-50 p-2"><div className="text-amber-700">1〜30日</div><div className="font-medium">{yen(summary.aging.d1_30)}</div></div>
              <div className="rounded bg-amber-100 p-2"><div className="text-amber-800">31〜60日</div><div className="font-medium">{yen(summary.aging.d31_60)}</div></div>
              <div className="rounded bg-red-50 p-2"><div className="text-red-700">61〜90日</div><div className="font-medium">{yen(summary.aging.d61_90)}</div></div>
              <div className="rounded bg-red-100 p-2"><div className="text-red-800">90日超</div><div className="font-medium">{yen(summary.aging.over90)}</div></div>
            </div>
          </div>

          <h2 className="mb-2 text-sm font-medium">支払予定</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
                <th className="px-2 py-1">発注</th><th className="px-2 py-1">仕入先</th><th className="px-2 py-1">支払期限</th><th className="px-2 py-1 text-right">未払額</th><th className="px-2 py-1"></th>
              </tr>
            </thead>
            <tbody>
              {summary.upcoming.map((d) => (
                <tr key={d.number} className="border-b border-neutral-100">
                  <td className="px-2 py-2 font-mono text-xs">{d.number}</td>
                  <td className="px-2 py-2">{d.supplier}</td>
                  <td className="px-2 py-2 text-xs">{d.dueDate}{d.overdueDays > 0 && <span className="ml-1 rounded bg-red-100 px-1.5 py-0.5 text-red-800">{d.overdueDays}日超過</span>}</td>
                  <td className="px-2 py-2 text-right font-medium">{yen(d.amountDue)}</td>
                  <td className="px-2 py-2 text-right">{canPay && <button onClick={() => pay(d)} className="text-blue-600 hover:underline">支払記録</button>}</td>
                </tr>
              ))}
              {summary.upcoming.length === 0 && <tr><td colSpan={5} className="px-2 py-4 text-center text-sm text-neutral-500">未払の買掛金はありません。</td></tr>}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
