"use client";
/** 経営分析。売上・仕入・経費・粗利の月次推移を折れ線＋棒グラフ（インラインSVG）で表示。 */
import * as React from "react";
import { formatYen } from "@platform/report";
import { AsyncBoundary, Button, ComboChart, PageShell } from "@platform/ui";

interface Point { month: string; sales: number; purchases: number; expenses: number; profit: number; }
interface Summary { totalSales: number; totalProfit: number; avgProfit: number; profitMoM: number; }
interface Data { from: string; to: string; points: Point[]; summary: Summary; }

const yen = (n: number) => formatYen(n);

export interface AnalyticsClientProps { fetchImpl?: typeof fetch; }

export function AnalyticsClient({ fetchImpl }: AnalyticsClientProps) {
  const [data, setData] = React.useState<Data | null>(null);
  const [error, setError] = React.useState("");
  const [months, setMonths] = React.useState(6);
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;

  // **再試行できるように名前を付ける。**
  // 即時関数のままだと、失敗しても呼び直す手段が無い
  const load = React.useCallback(async () => {
    setError("");
      const now = new Date();
      const to = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const start = new Date(Date.UTC(now.getFullYear(), now.getMonth() - (months - 1), 1));
      const from = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}`;
      const res = await doFetch(`/api/analytics/trend?from=${from}-01&to=${to}-01`);
      if (res.ok) setData((await res.json()) as Data);
  }, [doFetch]);

  React.useEffect(() => { void load(); }, [load]);

  // **`AsyncBoundary` に渡す前に返す。** children は JSX なので
  // **この部品が判断するより先に評価される**——`data` が null のままだと
  // `data.…` で画面ごと落ちる(2026-08 の型検査で 7 画面が同じ形だった)。
  if (data === null) {
    return <AsyncBoundary loading={error === ""} error={error} onRetry={() => void load()} />;
  }

  const pts = data.points;
  // **グラフは @platform/ui の ComboChart に任せる。** 軸・凡例・目盛り・整形・
  // レスポンシブ・ツールチップが揃っており、自前 SVG では毎回作り直しになる
  const chartData = pts.map((p) => ({
    month: p.month.slice(5),
    sales: p.sales,
    cost: p.purchases + p.expenses,
    profit: p.profit,
  }));

  return (
    <AsyncBoundary loading={false} error={error} onRetry={() => void load()}>
        <PageShell title="経営分析" width="wide">
      <p className="mb-4 text-xs text-[var(--color-muted)]">{data.from} 〜 {data.to} の月次推移（売上＝棒、粗利＝折れ線）。</p>
      <div className="mb-3 flex gap-1">{[3, 6, 12].map((m) => <Button key={m} onClick={() => setMonths(m)} variant="tab" data-state={months === m ? "active" : undefined}>{m}か月</Button>)}</div>

      <div className="mb-4 grid grid-cols-4 gap-3 text-center text-sm">
        <div className="rounded border border-[var(--color-border)] p-3"><div className="text-xs text-[var(--color-muted)]">総売上</div><div className="mt-1 font-bold">{yen(data.summary.totalSales)}</div></div>
        <div className="rounded border border-[var(--color-border)] p-3"><div className="text-xs text-[var(--color-muted)]">総粗利</div><div className="mt-1 font-bold">{yen(data.summary.totalProfit)}</div></div>
        <div className="rounded border border-[var(--color-border)] p-3"><div className="text-xs text-[var(--color-muted)]">月平均粗利</div><div className="mt-1 font-bold">{yen(data.summary.avgProfit)}</div></div>
        <div className="rounded border border-[var(--color-border)] p-3"><div className="text-xs text-[var(--color-muted)]">前月比（粗利）</div><div className={`mt-1 font-bold ${data.summary.profitMoM >= 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}`}>{data.summary.profitMoM >= 0 ? "+" : ""}{yen(data.summary.profitMoM)}</div></div>
      </div>

      <div className="rounded border border-[var(--color-border)] p-4">
        <ComboChart
          data={chartData}
          xKey="month"
          height={260}
          unit="currency"
          series={[
            { key: "sales", name: "売上", type: "bar" },
            { key: "cost", name: "仕入＋経費", type: "bar" },
            { key: "profit", name: "粗利", type: "line" },
          ]}
        />
      </div>

      <table className="mt-4 w-full text-sm">
        <thead><tr className="border-b border-[var(--color-border)] text-left text-xs text-[var(--color-muted)]"><th className="px-2 py-1">月</th><th className="px-2 py-1 text-right">売上</th><th className="px-2 py-1 text-right">仕入</th><th className="px-2 py-1 text-right">経費</th><th className="px-2 py-1 text-right">粗利</th></tr></thead>
        <tbody>
          {pts.map((p) => (
            <tr key={p.month} className="border-b border-[var(--color-border)]">
              <td className="px-2 py-1.5">{p.month}</td>
              <td className="px-2 py-1.5 text-right">{yen(p.sales)}</td>
              <td className="px-2 py-1.5 text-right">{yen(p.purchases)}</td>
              <td className="px-2 py-1.5 text-right">{yen(p.expenses)}</td>
              <td className={`px-2 py-1.5 text-right font-medium ${p.profit < 0 ? "text-[var(--color-danger)]" : ""}`}>{yen(p.profit)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </PageShell>
    </AsyncBoundary>
  );
}
