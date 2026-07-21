"use client";
/** ダッシュボードデモ。グリッドレイアウト + KPIカード + CSV/PNGエクスポート付きチャート。 */
import { DashboardGrid, DashboardWidget, StatCard, ChartCard, BarChart, LineChart, PieChart, Icon } from "@platform/ui";

const monthly = [
  { month: "1月", 売上: 420, 費用: 280 }, { month: "2月", 売上: 380, 費用: 260 },
  { month: "3月", 売上: 510, 費用: 300 }, { month: "4月", 売上: 470, 費用: 290 },
  { month: "5月", 売上: 560, 費用: 320 }, { month: "6月", 売上: 610, 費用: 340 },
];
const share = [{ name: "文具", value: 300 }, { name: "食品", value: 520 }, { name: "家電", value: 390 }];
const csvCols = [{ key: "month", header: "月" }, { key: "売上", header: "売上" }, { key: "費用", header: "費用" }];

export default function Page() {
  return (
    <main style={{ maxWidth: 1100, margin: "2.5rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "1rem" }}>ダッシュボード</h1>

      <DashboardGrid columns={12}>
        <DashboardWidget colSpan={3} bare><StatCard label="今月売上" value="¥6,100,000" delta="+8.9% 前月比" trend="up" icon={<Icon name="TrendingUp" className="h-5 w-5" />} /></DashboardWidget>
        <DashboardWidget colSpan={3} bare><StatCard label="新規顧客" value="128" delta="+12" trend="up" icon={<Icon name="UserPlus" className="h-5 w-5" />} /></DashboardWidget>
        <DashboardWidget colSpan={3} bare><StatCard label="解約率" value="2.1%" delta="-0.3pt" trend="down" icon={<Icon name="UserMinus" className="h-5 w-5" />} /></DashboardWidget>
        <DashboardWidget colSpan={3} bare><StatCard label="平均単価" value="¥4,760" delta="±0" trend="flat" icon={<Icon name="Receipt" className="h-5 w-5" />} /></DashboardWidget>

        <DashboardWidget colSpan={8} bare>
          <ChartCard title="月次 売上/費用(CSV・PNG出力可)" data={monthly} csvColumns={csvCols} filename="月次売上">
            <BarChart data={monthly} xKey="month" series={[{ key: "売上" }, { key: "費用" }]} unit="万円" toggleable height={260} />
          </ChartCard>
        </DashboardWidget>
        <DashboardWidget colSpan={4} bare>
          <ChartCard title="カテゴリ構成" data={share} csvColumns={[{ key: "name", header: "カテゴリ" }, { key: "value", header: "売上" }]} filename="カテゴリ構成">
            <PieChart data={share} nameKey="name" valueKey="value" donut height={260} />
          </ChartCard>
        </DashboardWidget>

        <DashboardWidget colSpan={12} bare>
          <ChartCard title="売上推移(ズーム/ブラシ・PNG出力可)" data={monthly} csvColumns={csvCols} filename="売上推移">
            <LineChart data={monthly} xKey="month" series={[{ key: "売上" }, { key: "費用" }]} smooth unit="万円" brush height={240} />
          </ChartCard>
        </DashboardWidget>
      </DashboardGrid>

      <p style={{ marginTop: "1.5rem" }}><a href="/">← 戻る</a></p>
    </main>
  );
}
