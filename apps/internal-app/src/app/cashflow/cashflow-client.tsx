"use client";
/** 資金繰り（営業CF）。月次の現金収入・支出・収支・累計残を折れ線＋棒で表示。 */
import * as React from "react";

interface Row { month: string; inflow: number; outflow: number; net: number; cumulative: number; }
interface Summary { totalIn: number; totalOut: number; netCashFlow: number; ending: number; }
interface Data { from: string; to: string; opening: number; rows: Row[]; summary: Summary; }

const yen = (n: number) => `¥${n.toLocaleString()}`;

export interface CashflowClientProps { fetchImpl?: typeof fetch; }

export function CashflowClient({ fetchImpl }: CashflowClientProps) {
  const [data, setData] = React.useState<Data | null>(null);
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;

  React.useEffect(() => {
    void (async () => {
      const res = await doFetch("/api/cashflow");
      if (res.ok) setData((await res.json()) as Data);
    })();
  }, [doFetch]);

  if (!data) return <div className="mx-auto max-w-4xl p-6"><h1 className="text-2xl font-bold">資金繰り</h1><p className="mt-4 text-sm text-neutral-500">読み込み中…</p></div>;

  const rows = data.rows;
  const W = 640, H = 220, PAD = 40;
  const vals = rows.flatMap((r) => [r.inflow, r.outflow]);
  const maxVal = Math.max(1, ...vals);
  const minCum = Math.min(0, ...rows.map((r) => r.cumulative));
  const maxCum = Math.max(1, ...rows.map((r) => r.cumulative));
  const bx = (i: number) => PAD + (i + 0.5) * ((W - PAD * 2) / Math.max(1, rows.length));
  const by = (v: number) => H - PAD - (v / maxVal) * (H - PAD * 2) * 0.9;
  const cy = (v: number) => H - PAD - ((v - minCum) / (maxCum - minCum || 1)) * (H - PAD * 2);
  const barW = Math.max(5, (W - PAD * 2) / Math.max(1, rows.length) * 0.35);
  const cumPath = rows.map((r, i) => `${i === 0 ? "M" : "L"}${bx(i).toFixed(1)},${cy(r.cumulative).toFixed(1)}`).join(" ");

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="mb-1 text-2xl font-bold">資金繰り（営業キャッシュフロー）</h1>
      <p className="mb-4 text-xs text-neutral-500">{data.from} 〜 {data.to}。入金＝収入、仕入支払・経費・報酬＝支出。折れ線は累計残。</p>

      <div className="mb-4 grid grid-cols-4 gap-3 text-center text-sm">
        <div className="rounded border border-neutral-200 p-3"><div className="text-xs text-neutral-500">総収入</div><div className="mt-1 font-bold">{yen(data.summary.totalIn)}</div></div>
        <div className="rounded border border-neutral-200 p-3"><div className="text-xs text-neutral-500">総支出</div><div className="mt-1 font-bold">{yen(data.summary.totalOut)}</div></div>
        <div className="rounded border border-neutral-200 p-3"><div className="text-xs text-neutral-500">純キャッシュフロー</div><div className={`mt-1 font-bold ${data.summary.netCashFlow >= 0 ? "text-green-700" : "text-red-600"}`}>{data.summary.netCashFlow >= 0 ? "+" : ""}{yen(data.summary.netCashFlow)}</div></div>
        <div className="rounded border border-neutral-200 p-3"><div className="text-xs text-neutral-500">期末残高</div><div className="mt-1 font-bold">{yen(data.summary.ending)}</div></div>
      </div>

      <div className="rounded border border-neutral-200 p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="資金繰りグラフ">
          <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="#d4d4d4" />
          {rows.map((r, i) => (
            <g key={r.month}>
              <rect x={bx(i) - barW - 1} y={by(r.inflow)} width={barW} height={H - PAD - by(r.inflow)} fill="#86efac" />
              <rect x={bx(i) + 1} y={by(r.outflow)} width={barW} height={H - PAD - by(r.outflow)} fill="#fca5a5" />
              <text x={bx(i)} y={H - PAD + 14} textAnchor="middle" fontSize="9" fill="#737373">{r.month.slice(5)}</text>
            </g>
          ))}
          <path d={cumPath} fill="none" stroke="var(--color-primary, #2563eb)" strokeWidth={2} />
          {rows.map((r, i) => <circle key={r.month} cx={bx(i)} cy={cy(r.cumulative)} r={2.5} fill="var(--color-primary, #2563eb)" />)}
        </svg>
        <div className="mt-2 flex gap-4 text-xs text-neutral-500">
          <span className="flex items-center gap-1"><span className="h-2 w-3 bg-green-300"></span>収入</span>
          <span className="flex items-center gap-1"><span className="h-2 w-3 bg-red-300"></span>支出</span>
          <span className="flex items-center gap-1"><span className="h-0.5 w-3 bg-blue-600"></span>累計残</span>
        </div>
      </div>

      <table className="mt-4 w-full text-sm">
        <thead><tr className="border-b border-neutral-200 text-left text-xs text-neutral-500"><th className="px-2 py-1">月</th><th className="px-2 py-1 text-right">収入</th><th className="px-2 py-1 text-right">支出</th><th className="px-2 py-1 text-right">当月収支</th><th className="px-2 py-1 text-right">累計残</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.month} className="border-b border-neutral-100">
              <td className="px-2 py-1.5">{r.month}</td>
              <td className="px-2 py-1.5 text-right">{yen(r.inflow)}</td>
              <td className="px-2 py-1.5 text-right">{yen(r.outflow)}</td>
              <td className={`px-2 py-1.5 text-right font-medium ${r.net < 0 ? "text-red-600" : ""}`}>{r.net >= 0 ? "+" : ""}{yen(r.net)}</td>
              <td className={`px-2 py-1.5 text-right ${r.cumulative < 0 ? "text-red-600" : ""}`}>{yen(r.cumulative)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
