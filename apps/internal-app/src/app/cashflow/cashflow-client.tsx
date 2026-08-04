"use client";
/** 資金繰り（営業CF）。月次の現金収入・支出・収支・累計残を折れ線＋棒で表示。 */
import * as React from "react";
import { ComboChart } from "@platform/ui";

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

  if (!data) return <div className="mx-auto max-w-4xl p-6"><h1 className="text-2xl font-bold">資金繰り</h1><p className="mt-4 text-sm text-[var(--color-muted)]">読み込み中…</p></div>;

  const rows = data.rows;
  // **グラフは @platform/ui の ComboChart に任せる**(軸・凡例・整形・ツールチップ込み)。
  // 累計残は収支の積み上げなので、収入・支出と**同じ金額軸**で読める(第2軸は使わない)
  const chartData = rows.map((r) => ({
    month: r.month.slice(5),
    inflow: r.inflow,
    outflow: r.outflow,
    cumulative: r.cumulative,
  }));

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="mb-1 text-2xl font-bold">資金繰り（営業キャッシュフロー）</h1>
      <p className="mb-4 text-xs text-[var(--color-muted)]">{data.from} 〜 {data.to}。入金＝収入、仕入支払・経費・報酬＝支出。折れ線は累計残。</p>

      <div className="mb-4 grid grid-cols-4 gap-3 text-center text-sm">
        <div className="rounded border border-[var(--color-border)] p-3"><div className="text-xs text-[var(--color-muted)]">総収入</div><div className="mt-1 font-bold">{yen(data.summary.totalIn)}</div></div>
        <div className="rounded border border-[var(--color-border)] p-3"><div className="text-xs text-[var(--color-muted)]">総支出</div><div className="mt-1 font-bold">{yen(data.summary.totalOut)}</div></div>
        <div className="rounded border border-[var(--color-border)] p-3"><div className="text-xs text-[var(--color-muted)]">純キャッシュフロー</div><div className={`mt-1 font-bold ${data.summary.netCashFlow >= 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}`}>{data.summary.netCashFlow >= 0 ? "+" : ""}{yen(data.summary.netCashFlow)}</div></div>
        <div className="rounded border border-[var(--color-border)] p-3"><div className="text-xs text-[var(--color-muted)]">期末残高</div><div className="mt-1 font-bold">{yen(data.summary.ending)}</div></div>
      </div>

      <div className="rounded border border-[var(--color-border)] p-4">
        <ComboChart
          data={chartData}
          xKey="month"
          height={260}
          unit="currency"
          series={[
            { key: "inflow", name: "収入", type: "bar" },
            { key: "outflow", name: "支出", type: "bar" },
            { key: "cumulative", name: "累計残", type: "line" },
          ]}
        />
      </div>

      <table className="mt-4 w-full text-sm">
        <thead><tr className="border-b border-[var(--color-border)] text-left text-xs text-[var(--color-muted)]"><th className="px-2 py-1">月</th><th className="px-2 py-1 text-right">収入</th><th className="px-2 py-1 text-right">支出</th><th className="px-2 py-1 text-right">当月収支</th><th className="px-2 py-1 text-right">累計残</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.month} className="border-b border-[var(--color-border)]">
              <td className="px-2 py-1.5">{r.month}</td>
              <td className="px-2 py-1.5 text-right">{yen(r.inflow)}</td>
              <td className="px-2 py-1.5 text-right">{yen(r.outflow)}</td>
              <td className={`px-2 py-1.5 text-right font-medium ${r.net < 0 ? "text-[var(--color-danger)]" : ""}`}>{r.net >= 0 ? "+" : ""}{yen(r.net)}</td>
              <td className={`px-2 py-1.5 text-right ${r.cumulative < 0 ? "text-[var(--color-danger)]" : ""}`}>{yen(r.cumulative)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
