"use client";
/** 年次推移。売上・費用を棒、純利益を折れ線でインライン SVG 描画。前年比の伸び率も表示。 */
import * as React from "react";

interface TrendPoint { year: number; revenue: number; expense: number; netIncome: number; growth: number | null; }
interface TrendData { trend: TrendPoint[]; range: { max: number; min: number }; totals: { revenue: number; expense: number; netIncome: number }; }

const yen = (n: number) => `¥${n.toLocaleString()}`;

export interface TrendClientProps { fetchImpl?: typeof fetch; }

export function TrendClient({ fetchImpl }: TrendClientProps) {
  const [years, setYears] = React.useState(3);
  const [data, setData] = React.useState<TrendData | null>(null);
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;

  const reload = React.useCallback(async () => {
    const res = await doFetch(`/api/accounting/trend?years=${years}`);
    if (res.ok) setData((await res.json()) as TrendData);
  }, [doFetch, years]);
  React.useEffect(() => { void reload(); }, [reload]);

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-2xl font-bold">年次推移</h1>
        <label className="text-xs text-neutral-500">表示年数
          <select value={years} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setYears(Number(e.target.value))} className="ml-1 rounded border border-neutral-300 px-2 py-1 text-sm">
            <option value={3}>3年</option><option value={5}>5年</option><option value={10}>10年</option>
          </select>
        </label>
      </div>
      <p className="mb-4 text-xs text-neutral-500">売上・費用（棒）と当期純利益（折れ線）の推移です。手動仕訳・減価償却・科目マスタを反映して集計しています。</p>

      {data && (() => {
        const pts = data.trend;
        if (pts.length === 0) return <p className="text-sm text-neutral-500">データがありません。</p>;
        const W = 720, H = 300, padL = 60, padB = 30, padT = 20;
        const max = Math.max(data.range.max, 1);
        const min = Math.min(data.range.min, 0);
        const span = max - min || 1;
        const y = (v: number) => padT + (H - padT - padB) * (1 - (v - min) / span);
        const bandW = (W - padL) / pts.length;
        const barW = bandW * 0.28;
        const zero = y(0);
        return (
          <div className="overflow-x-auto">
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="年次推移グラフ">
              <line x1={padL} y1={zero} x2={W} y2={zero} stroke="#cbd5e1" />
              {[max, (max + min) / 2, min].map((v, i) => (
                <g key={i}><text x={padL - 6} y={y(v) + 3} textAnchor="end" fontSize="10" fill="#94a3b8">{Math.round(v / 10000)}万</text><line x1={padL} y1={y(v)} x2={W} y2={y(v)} stroke="#f1f5f9" /></g>
              ))}
              {pts.map((p, i) => {
                const cx = padL + bandW * i + bandW / 2;
                return (
                  <g key={p.year}>
                    <rect x={cx - barW - 2} y={Math.min(y(p.revenue), zero)} width={barW} height={Math.abs(y(p.revenue) - zero)} fill="#3b82f6"><title>{`売上 ${yen(p.revenue)}`}</title></rect>
                    <rect x={cx + 2} y={Math.min(y(p.expense), zero)} width={barW} height={Math.abs(y(p.expense) - zero)} fill="#f59e0b"><title>{`費用 ${yen(p.expense)}`}</title></rect>
                    <text x={cx} y={H - padB + 16} textAnchor="middle" fontSize="11" fill="#475569">{p.year}</text>
                  </g>
                );
              })}
              <polyline fill="none" stroke="var(--color-success, #10b981)" strokeWidth="2" points={pts.map((p, i) => `${padL + bandW * i + bandW / 2},${y(p.netIncome)}`).join(" ")} />
              {pts.map((p, i) => <circle key={p.year} cx={padL + bandW * i + bandW / 2} cy={y(p.netIncome)} r="3.5" fill="var(--color-success, #10b981)"><title>{`純利益 ${yen(p.netIncome)}`}</title></circle>)}
            </svg>
            <div className="mt-2 flex gap-4 text-xs text-neutral-500">
              <span className="flex items-center gap-1"><span className="inline-block h-2 w-3 bg-blue-500"></span>売上</span>
              <span className="flex items-center gap-1"><span className="inline-block h-2 w-3 bg-amber-500"></span>費用</span>
              <span className="flex items-center gap-1"><span className="inline-block h-2 w-3 bg-emerald-500"></span>純利益</span>
            </div>
          </div>
        );
      })()}

      {data && (
        <table className="mt-6 w-full text-sm">
          <thead><tr className="border-b border-neutral-200 text-left text-xs text-neutral-500"><th className="px-2 py-1">年度</th><th className="px-2 py-1 text-right">売上</th><th className="px-2 py-1 text-right">費用</th><th className="px-2 py-1 text-right">純利益</th><th className="px-2 py-1 text-right">純利益 前年比</th></tr></thead>
          <tbody>
            {data.trend.map((p) => (
              <tr key={p.year} className="border-b border-neutral-100">
                <td className="px-2 py-1.5">{p.year}</td>
                <td className="px-2 py-1.5 text-right">{yen(p.revenue)}</td>
                <td className="px-2 py-1.5 text-right">{yen(p.expense)}</td>
                <td className={`px-2 py-1.5 text-right font-medium ${p.netIncome < 0 ? "text-red-600" : ""}`}>{yen(p.netIncome)}</td>
                <td className={`px-2 py-1.5 text-right text-xs ${(p.growth ?? 0) < 0 ? "text-red-600" : "text-neutral-600"}`}>{p.growth === null ? "—" : `${p.growth >= 0 ? "+" : ""}${Math.round(p.growth * 1000) / 10}%`}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-neutral-300 font-medium"><td className="px-2 py-1.5">期間合計</td><td className="px-2 py-1.5 text-right">{yen(data.totals.revenue)}</td><td className="px-2 py-1.5 text-right">{yen(data.totals.expense)}</td><td className="px-2 py-1.5 text-right">{yen(data.totals.netIncome)}</td><td></td></tr>
          </tbody>
        </table>
      )}
    </div>
  );
}
