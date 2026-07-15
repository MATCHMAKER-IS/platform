"use client";
/** 経営分析。売上・仕入・経費・粗利の月次推移を折れ線＋棒グラフ（インラインSVG）で表示。 */
import * as React from "react";

interface Point { month: string; sales: number; purchases: number; expenses: number; profit: number; }
interface Summary { totalSales: number; totalProfit: number; avgProfit: number; profitMoM: number; }
interface Data { from: string; to: string; points: Point[]; summary: Summary; }

const yen = (n: number) => `¥${n.toLocaleString()}`;

export interface AnalyticsClientProps { fetchImpl?: typeof fetch; }

export function AnalyticsClient({ fetchImpl }: AnalyticsClientProps) {
  const [data, setData] = React.useState<Data | null>(null);
  const [months, setMonths] = React.useState(6);
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;

  React.useEffect(() => {
    void (async () => {
      const now = new Date();
      const to = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const start = new Date(Date.UTC(now.getFullYear(), now.getMonth() - (months - 1), 1));
      const from = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}`;
      const res = await doFetch(`/api/analytics/trend?from=${from}-01&to=${to}-01`);
      if (res.ok) setData((await res.json()) as Data);
    })();
  }, [doFetch]);

  if (!data) return <div className="mx-auto max-w-4xl p-6"><h1 className="text-2xl font-bold">経営分析</h1><p className="mt-4 text-sm text-neutral-500">読み込み中…</p></div>;

  const pts = data.points;
  const W = 640, H = 240, PAD = 40;
  const maxVal = Math.max(1, ...pts.map((p) => Math.max(p.sales, p.purchases + p.expenses)));
  const bx = (i: number) => PAD + (i + 0.5) * ((W - PAD * 2) / Math.max(1, pts.length));
  const by = (v: number) => H - PAD - (v / maxVal) * (H - PAD * 2);
  const barW = Math.max(6, (W - PAD * 2) / Math.max(1, pts.length) * 0.5);
  const profitPath = pts.map((p, i) => `${i === 0 ? "M" : "L"}${bx(i).toFixed(1)},${by(p.profit).toFixed(1)}`).join(" ");

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="mb-1 text-2xl font-bold">経営分析</h1>
      <p className="mb-4 text-xs text-neutral-500">{data.from} 〜 {data.to} の月次推移（売上＝棒、粗利＝折れ線）。</p>
      <div className="mb-3 flex gap-1">{[3, 6, 12].map((m) => <button key={m} onClick={() => setMonths(m)} className={`rounded px-2 py-1 text-xs ${months === m ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-600"}`}>{m}か月</button>)}</div>

      <div className="mb-4 grid grid-cols-4 gap-3 text-center text-sm">
        <div className="rounded border border-neutral-200 p-3"><div className="text-xs text-neutral-500">総売上</div><div className="mt-1 font-bold">{yen(data.summary.totalSales)}</div></div>
        <div className="rounded border border-neutral-200 p-3"><div className="text-xs text-neutral-500">総粗利</div><div className="mt-1 font-bold">{yen(data.summary.totalProfit)}</div></div>
        <div className="rounded border border-neutral-200 p-3"><div className="text-xs text-neutral-500">月平均粗利</div><div className="mt-1 font-bold">{yen(data.summary.avgProfit)}</div></div>
        <div className="rounded border border-neutral-200 p-3"><div className="text-xs text-neutral-500">前月比（粗利）</div><div className={`mt-1 font-bold ${data.summary.profitMoM >= 0 ? "text-green-700" : "text-red-600"}`}>{data.summary.profitMoM >= 0 ? "+" : ""}{yen(data.summary.profitMoM)}</div></div>
      </div>

      <div className="rounded border border-neutral-200 p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="月次推移グラフ">
          <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="#d4d4d4" />
          {pts.map((p, i) => {
            const sh = by(p.purchases + p.expenses);
            return (
              <g key={p.month}>
                <rect x={bx(i) - barW / 2} y={by(p.sales)} width={barW} height={H - PAD - by(p.sales)} fill="#bfdbfe" />
                <rect x={bx(i) - barW / 2} y={sh} width={barW} height={H - PAD - sh} fill="#fca5a5" opacity={0.6} />
                <text x={bx(i)} y={H - PAD + 14} textAnchor="middle" fontSize="9" fill="#737373">{p.month.slice(5)}</text>
              </g>
            );
          })}
          <path d={profitPath} fill="none" stroke="var(--color-success, #16a34a)" strokeWidth={2} />
          {pts.map((p, i) => <circle key={p.month} cx={bx(i)} cy={by(p.profit)} r={2.5} fill="var(--color-success, #16a34a)" />)}
        </svg>
        <div className="mt-2 flex gap-4 text-xs text-neutral-500">
          <span className="flex items-center gap-1"><span className="h-2 w-3 bg-blue-200"></span>売上</span>
          <span className="flex items-center gap-1"><span className="h-2 w-3 bg-red-300 opacity-60"></span>仕入＋経費</span>
          <span className="flex items-center gap-1"><span className="h-0.5 w-3 bg-green-600"></span>粗利</span>
        </div>
      </div>

      <table className="mt-4 w-full text-sm">
        <thead><tr className="border-b border-neutral-200 text-left text-xs text-neutral-500"><th className="px-2 py-1">月</th><th className="px-2 py-1 text-right">売上</th><th className="px-2 py-1 text-right">仕入</th><th className="px-2 py-1 text-right">経費</th><th className="px-2 py-1 text-right">粗利</th></tr></thead>
        <tbody>
          {pts.map((p) => (
            <tr key={p.month} className="border-b border-neutral-100">
              <td className="px-2 py-1.5">{p.month}</td>
              <td className="px-2 py-1.5 text-right">{yen(p.sales)}</td>
              <td className="px-2 py-1.5 text-right">{yen(p.purchases)}</td>
              <td className="px-2 py-1.5 text-right">{yen(p.expenses)}</td>
              <td className={`px-2 py-1.5 text-right font-medium ${p.profit < 0 ? "text-red-600" : ""}`}>{yen(p.profit)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
