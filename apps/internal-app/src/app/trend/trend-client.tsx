"use client";
/** 年次推移。売上・費用を棒、純利益を折れ線でインライン SVG 描画。前年比の伸び率も表示。 */
import * as React from "react";
import { ComboChart, Select } from "@platform/ui";

interface TrendPoint { year: number; revenue: number; expense: number; netIncome: number; growth: number | null; }
interface TrendData { trend: TrendPoint[]; range: { max: number; min: number }; totals: { revenue: number; expense: number; netIncome: number }; }

const yen = (n: number) => `¥${n.toLocaleString()}`;

export interface TrendClientProps { fetchImpl?: typeof fetch; }

/** 表示年数の選択肢。**`SelectOption.value` は string** なので、onChange で数値に戻す。 */
const YEAR_OPTIONS = [{ label: "3年", value: "3" }, { label: "5年", value: "5" }, { label: "10年", value: "10" }];

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
        <label className="text-xs text-[var(--color-muted)]">表示年数
          <Select
            value={years}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setYears(Number(e.target.value))}
            className="ml-1 rounded border border-[var(--color-border)] px-2 py-1 text-sm"
            options={YEAR_OPTIONS}
          />
        </label>
      </div>
      <p className="mb-4 text-xs text-[var(--color-muted)]">売上・費用（棒）と当期純利益（折れ線）の推移です。手動仕訳・減価償却・科目マスタを反映して集計しています。</p>

      {data && (() => {
        const pts = data.trend;
        if (pts.length === 0) return <p className="text-sm text-[var(--color-muted)]">データがありません。</p>;
        // **グラフは @platform/ui の ComboChart に任せる**(軸・凡例・整形・ツールチップ込み)。
        // 純利益は負にもなるので、部品側が 0 を跨ぐ軸を描く
        const chartData = pts.map((p) => ({
          year: String(p.year),
          revenue: p.revenue,
          expense: p.expense,
          netIncome: p.netIncome,
        }));
        return (
          <div className="overflow-x-auto">
            <ComboChart
              data={chartData}
              xKey="year"
              height={300}
              unit="currency"
              referenceValue={0}
              series={[
                { key: "revenue", name: "売上", type: "bar" },
                { key: "expense", name: "費用", type: "bar" },
                { key: "netIncome", name: "純利益", type: "line" },
              ]}
            />
          </div>
        );
      })()}

      {data && (
        <table className="mt-6 w-full text-sm">
          <thead><tr className="border-b border-[var(--color-border)] text-left text-xs text-[var(--color-muted)]"><th className="px-2 py-1">年度</th><th className="px-2 py-1 text-right">売上</th><th className="px-2 py-1 text-right">費用</th><th className="px-2 py-1 text-right">純利益</th><th className="px-2 py-1 text-right">純利益 前年比</th></tr></thead>
          <tbody>
            {data.trend.map((p) => (
              <tr key={p.year} className="border-b border-[var(--color-border)]">
                <td className="px-2 py-1.5">{p.year}</td>
                <td className="px-2 py-1.5 text-right">{yen(p.revenue)}</td>
                <td className="px-2 py-1.5 text-right">{yen(p.expense)}</td>
                <td className={`px-2 py-1.5 text-right font-medium ${p.netIncome < 0 ? "text-[var(--color-danger)]" : ""}`}>{yen(p.netIncome)}</td>
                <td className={`px-2 py-1.5 text-right text-xs ${(p.growth ?? 0) < 0 ? "text-[var(--color-danger)]" : "text-[var(--color-muted)]"}`}>{p.growth === null ? "—" : `${p.growth >= 0 ? "+" : ""}${Math.round(p.growth * 1000) / 10}%`}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-[var(--color-border)] font-medium"><td className="px-2 py-1.5">期間合計</td><td className="px-2 py-1.5 text-right">{yen(data.totals.revenue)}</td><td className="px-2 py-1.5 text-right">{yen(data.totals.expense)}</td><td className="px-2 py-1.5 text-right">{yen(data.totals.netIncome)}</td><td></td></tr>
          </tbody>
        </table>
      )}
    </div>
  );
}
