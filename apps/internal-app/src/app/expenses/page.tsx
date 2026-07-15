"use client";
/** 経費ダッシュボード。基盤(datetime/utils/ui)を結線したサンプル業務画面。 */
import { useMemo } from "react";
import {
  KpiCard, MetricGrid, TimelineChart, Histogram, StatSummary, DataTable, Trend,
  type DataTableColumn,
} from "@platform/ui";
import { formatManOku, formatNumber, formatPercent, movingAverage } from "@platform/utils";
import { formatWareki } from "@platform/datetime";
import { summarize, type Expense } from "../../lib/expense.js";
import { SAMPLE_EXPENSES } from "../../lib/sample-expenses.js";

const yen = (n: number) => `¥${formatNumber(n, {})}`;

export default function ExpensesPage() {
  const expenses = SAMPLE_EXPENSES;
  const s = useMemo(() => summarize(expenses), [expenses]);
  const monthSeries = s.byMonth.map((m, i) => ({ x: i, y: m.total }));
  const ma = movingAverage(s.byMonth.map((m) => m.total), 2);
  const latest = s.byMonth[s.byMonth.length - 1];
  const prev = s.byMonth[s.byMonth.length - 2];

  const columns: DataTableColumn<Expense & Record<string, unknown>>[] = [
    { key: "date", header: "日付", sortable: true },
    { key: "category", header: "カテゴリ", sortable: true },
    { key: "amount", header: "金額", align: "right", sortable: true, render: (r) => yen(r.amount) },
    { key: "note", header: "備考" },
  ];

  return (
    <main style={{ maxWidth: 900, margin: "2rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.6rem", fontWeight: 700, marginBottom: ".25rem" }}>経費ダッシュボード</h1>
      <p style={{ color: "var(--color-muted)", marginBottom: "1.25rem" }}>{formatWareki(new Date())}時点 / 全{s.count}件</p>

      <MetricGrid minWidth={200} className="mb-6">
        <KpiCard label="合計" value={s.total} format={yen} series={s.byMonth.map((m) => m.total)} />
        <KpiCard label="平均単価" value={Math.round(s.average)} format={yen} />
        <KpiCard label="今月" value={latest?.total ?? 0} previous={prev?.total} format={yen} />
        <KpiCard label="外れ値" value={s.outliers.length} suffix="件" higherIsBetter={false} />
      </MetricGrid>

      <section style={{ margin: "1.5rem 0" }}>
        <h2 style={{ fontWeight: 700, marginBottom: ".5rem" }}>月次推移</h2>
        <TimelineChart
          width={840} height={220} showTooltip
          formatX={(x) => s.byMonth[x]?.month ?? String(x)}
          formatY={(y) => yen(y)}
          series={[
            { name: "月次合計", points: monthSeries, showArea: true },
            { name: "移動平均(2)", color: "#f59e0b", points: ma.map((v, i) => ({ x: i + 1, y: v })) },
          ]}
        />
      </section>

      <section style={{ margin: "1.5rem 0" }}>
        <h2 style={{ fontWeight: 700, marginBottom: ".5rem" }}>カテゴリ別</h2>
        {s.byCategory.map((c) => (
          <div key={c.category} style={{ display: "flex", alignItems: "center", gap: "1rem", padding: ".25rem 0" }}>
            <span style={{ width: 90 }}>{c.category}</span>
            <div style={{ flex: 1, background: "var(--color-muted)/15", borderRadius: 4, height: 14 }}>
              <div style={{ width: `${c.share * 100}%`, background: "var(--color-primary)", height: "100%", borderRadius: 4 }} />
            </div>
            <span style={{ width: 90, textAlign: "right" }}>{yen(c.total)}</span>
            <span style={{ width: 56, textAlign: "right", color: "var(--color-muted)" }}>{formatPercent(c.share, 0)}</span>
          </div>
        ))}
      </section>

      <section style={{ margin: "1.5rem 0" }}>
        <h2 style={{ fontWeight: 700, marginBottom: ".5rem" }}>金額の分布と要約</h2>
        <Histogram values={expenses.map((e) => e.amount)} bins={6} height={120} />
        <div style={{ marginTop: ".75rem" }}><StatSummary values={expenses.map((e) => e.amount)} format={yen} /></div>
      </section>

      <section style={{ margin: "1.5rem 0" }}>
        <h2 style={{ fontWeight: 700, marginBottom: ".5rem" }}>明細</h2>
        <DataTable rows={expenses as (Expense & Record<string, unknown>)[]} columns={columns} searchKeys={["category", "note"]} highlightSearch pageSize={8} csvFilename="expenses.csv" />
      </section>
    </main>
  );
}
