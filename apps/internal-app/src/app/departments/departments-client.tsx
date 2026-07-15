"use client";
/** 部門別会計。部門ごとの予算・実績・差異（経費を予算区分の部門へ按分）。 */
import * as React from "react";

interface Dept { department: string; budget: number; actual: number; variance: number; }
interface Data { period: string; departments: Dept[]; }

const yen = (n: number) => `¥${n.toLocaleString()}`;
const thisMonth = () => new Date().toISOString().slice(0, 7);

export interface DepartmentsClientProps { fetchImpl?: typeof fetch; }

export function DepartmentsClient({ fetchImpl }: DepartmentsClientProps) {
  const [period, setPeriod] = React.useState(thisMonth());
  const [data, setData] = React.useState<Data | null>(null);
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;

  React.useEffect(() => {
    void (async () => {
      const res = await doFetch(`/api/departments?period=${period}`);
      if (res.ok) setData((await res.json()) as Data);
    })();
  }, [doFetch, period]);

  const rows = data?.departments ?? [];
  const tb = rows.reduce((s, r) => s + r.budget, 0);
  const ta = rows.reduce((s, r) => s + r.actual, 0);

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">部門別会計</h1>
        <input type="month" value={period} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPeriod(e.target.value)} className="rounded border border-neutral-300 px-2 py-1 text-sm" />
      </div>
      <p className="mb-4 text-xs text-neutral-500">経費を予算区分の部門へ按分し、部門ごとの予実を表示します（複数部門の区分は予算額で比例配分）。</p>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
            <th className="px-2 py-1">部門</th><th className="px-2 py-1 text-right">予算</th><th className="px-2 py-1 text-right">実績</th><th className="px-2 py-1 text-right">差異</th><th className="px-2 py-1 text-right">消化率</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.department} className="border-b border-neutral-100">
              <td className="px-2 py-2">{r.department}</td>
              <td className="px-2 py-2 text-right">{yen(r.budget)}</td>
              <td className="px-2 py-2 text-right">{yen(r.actual)}</td>
              <td className={`px-2 py-2 text-right font-medium ${r.variance < 0 ? "text-red-600" : "text-green-700"}`}>{r.variance < 0 ? "" : "+"}{yen(r.variance)}</td>
              <td className="px-2 py-2 text-right text-xs">{r.budget > 0 ? `${Math.round((r.actual / r.budget) * 100)}%` : "—"}</td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={5} className="px-2 py-4 text-center text-sm text-neutral-500">この月の部門別データはありません。予算（部門×区分）を登録してください。</td></tr>}
          {rows.length > 0 && <tr className="border-t-2 border-neutral-300 font-medium"><td className="px-2 py-2">合計</td><td className="px-2 py-2 text-right">{yen(tb)}</td><td className="px-2 py-2 text-right">{yen(ta)}</td><td className={`px-2 py-2 text-right ${tb - ta < 0 ? "text-red-600" : "text-green-700"}`}>{tb - ta < 0 ? "" : "+"}{yen(tb - ta)}</td><td></td></tr>}
        </tbody>
      </table>
    </div>
  );
}
