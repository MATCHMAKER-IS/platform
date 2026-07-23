"use client";
/** ダッシュボードデモ。期間切替で KPI・グラフが連動。グリッド + KPIカード + CSV/PNG出力付きチャート。 */
import * as React from "react";
import { BarChart, Button, ChartCard, DashboardGrid, DashboardWidget, Icon, LineChart, PieChart, StatCard } from "@platform/ui";

type Row = { month: string; 売上: number; 費用: number };
const H12: Row[] = [
  { month: "7月", 売上: 350, 費用: 250 }, { month: "8月", 売上: 400, 費用: 270 },
  { month: "9月", 売上: 380, 費用: 260 }, { month: "10月", 売上: 440, 費用: 285 },
  { month: "11月", 売上: 490, 費用: 300 }, { month: "12月", 売上: 620, 費用: 360 },
  { month: "1月", 売上: 420, 費用: 280 }, { month: "2月", 売上: 380, 費用: 260 },
  { month: "3月", 売上: 510, 費用: 300 }, { month: "4月", 売上: 470, 費用: 290 },
  { month: "5月", 売上: 560, 費用: 320 }, { month: "6月", 売上: 610, 費用: 340 },
];
const share = [{ name: "文具", value: 300 }, { name: "食品", value: 520 }, { name: "家電", value: 390 }];
const csvCols = [{ key: "month", header: "月" }, { key: "売上", header: "売上" }, { key: "費用", header: "費用" }];
const yen = (man: number) => "¥" + (man * 10000).toLocaleString();
const pct = (a: number, b: number) => (b === 0 ? "±0" : ((a - b) / b >= 0 ? "+" : "") + (((a - b) / b) * 100).toFixed(1) + "% 前月比");
const trendOf = (a: number, b: number): "up" | "down" | "flat" => (a > b ? "up" : a < b ? "down" : "flat");

export function KpiDashboardDemo() {
  const [months, setMonths] = React.useState<6 | 12>(6);
  const data = React.useMemo(() => H12.slice(H12.length - months), [months]);
  const last = data[data.length - 1]!;
  const prev = data[data.length - 2] ?? last;
  const totalSales = data.reduce((n, r) => n + r.売上, 0);
  const avgSales = Math.round(totalSales / data.length);
  const profit = last.売上 - last.費用;
  const prevProfit = prev.売上 - prev.費用;

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem", flexWrap: "wrap", gap: 8 }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>ダッシュボード</h1>
        <div style={{ display: "flex", gap: 6 }}>
          {([6, 12] as const).map((m) => (
            <Button key={m} type="button" onClick={() => setMonths(m)}
              style={{ fontSize: 13, padding: "6px 14px", borderRadius: 999, cursor: "pointer", border: "1px solid var(--color-border)", background: months === m ? "var(--color-primary)" : "var(--color-bg)", color: months === m ? "var(--color-primary-fg)" : "var(--color-fg)" }}>
              直近{m}ヶ月</Button>))}
        </div>
      </div>

      <DashboardGrid columns={12}>
        <DashboardWidget colSpan={3} bare><StatCard label="今月売上" value={yen(last.売上)} delta={pct(last.売上, prev.売上)} trend={trendOf(last.売上, prev.売上)} icon={<Icon name="TrendingUp" className="h-5 w-5" />} /></DashboardWidget>
        <DashboardWidget colSpan={3} bare><StatCard label="今月利益" value={yen(profit)} delta={pct(profit, prevProfit)} trend={trendOf(profit, prevProfit)} icon={<Icon name="Wallet" className="h-5 w-5" />} /></DashboardWidget>
        <DashboardWidget colSpan={3} bare><StatCard label={`平均売上(${months}ヶ月)`} value={yen(avgSales)} delta={`合計 ${yen(totalSales)}`} trend="flat" icon={<Icon name="ChartColumn" className="h-5 w-5" />} /></DashboardWidget>
        <DashboardWidget colSpan={3} bare><StatCard label="原価率" value={((last.費用 / last.売上) * 100).toFixed(1) + "%"} delta={`費用 ${yen(last.費用)}`} trend={trendOf(prev.費用 / prev.売上, last.費用 / last.売上)} icon={<Icon name="Receipt" className="h-5 w-5" />} /></DashboardWidget>

        <DashboardWidget colSpan={8} bare>
          <ChartCard title={`月次 売上/費用・直近${months}ヶ月(CSV・PNG出力可)`} data={data} csvColumns={csvCols} filename="月次売上">
            <BarChart data={data} xKey="month" series={[{ key: "売上" }, { key: "費用" }]} unit="万円" toggleable height={260} />
          </ChartCard>
        </DashboardWidget>
        <DashboardWidget colSpan={4} bare>
          <ChartCard title="カテゴリ構成" data={share} csvColumns={[{ key: "name", header: "カテゴリ" }, { key: "value", header: "売上" }]} filename="カテゴリ構成">
            <PieChart data={share} nameKey="name" valueKey="value" donut height={260} />
          </ChartCard>
        </DashboardWidget>

        <DashboardWidget colSpan={12} bare>
          <ChartCard title="売上推移(ズーム/ブラシ・PNG出力可)" data={data} csvColumns={csvCols} filename="売上推移">
            <LineChart data={data} xKey="month" series={[{ key: "売上" }, { key: "費用" }]} smooth unit="万円" brush height={240} />
          </ChartCard>
        </DashboardWidget>
      </DashboardGrid>

      <p style={{ marginTop: "1.5rem" }}><a href="/">← 戻る</a></p>
    </>
  );
}
