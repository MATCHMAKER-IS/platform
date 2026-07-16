"use client";
/** グラフ(チャート)デモ。全種+主要オプション。 */
import { BarChart, LineChart, ComboChart, PieChart, RadarChart, ScatterChart, GanttChart, Heatmap, Treemap, FunnelChart, CandlestickChart, BubbleChart, BandChart, ChartHistogram, HorizontalBarChart, WaterfallChart, SankeyChart, ChartGauge, ProgressRing, CsvExportButton } from "@platform/ui";

const monthly = [
  { month: "1月", 売上: 420, 費用: 280, 利益率: 33 },
  { month: "2月", 売上: 380, 費用: 260, 利益率: 32 },
  { month: "3月", 売上: 510, 費用: 300, 利益率: 41 },
  { month: "4月", 売上: 470, 費用: 290, 利益率: 38 },
  { month: "5月", 売上: 560, 費用: 320, 利益率: 43 },
];
const stacked = [
  { 地域: "東京", 文具: 120, 食品: 200, 家電: 150 },
  { 地域: "大阪", 文具: 100, 食品: 180, 家電: 130 },
  { 地域: "名古屋", 文具: 80, 食品: 140, 家電: 110 },
];
const share = [
  { name: "文具", value: 300 }, { name: "食品", value: 520 }, { name: "家電", value: 390 }, { name: "書籍", value: 180 },
];
const skills = [
  { 項目: "速度", A: 80, B: 60 }, { 項目: "品質", A: 90, B: 70 }, { 項目: "コスト", A: 60, B: 85 },
  { 項目: "対応", A: 75, B: 65 }, { 項目: "実績", A: 85, B: 55 },
];

function Box({ children }: { children: React.ReactNode }) {
  return <div style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius)", padding: "1rem", background: "var(--color-bg)" }}>{children}</div>;
}

export default function Page() {
  const d = (day: number) => new Date(2026, 6, day);
  return (
    <main style={{ maxWidth: 980, margin: "3rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "1.5rem" }}>グラフ(チャート)</h1>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(420px, 1fr))", gap: "1rem" }}>
        <Box>
          <BarChart title="月次 売上/費用(単位・凡例・グリッド・表示切替)" data={monthly} xKey="month"
            series={[{ key: "売上" }, { key: "費用" }]} unit="万円" toggleable referenceValue={450} />
        </Box>
        <Box>
          <BarChart title="積み上げ棒(地域×カテゴリ)" data={stacked} xKey="地域"
            series={[{ key: "文具" }, { key: "食品" }, { key: "家電" }]} stacked unit="万円" toggleable />
        </Box>
        <Box>
          <BarChart title="横棒グラフ" data={stacked} xKey="地域" series={[{ key: "食品" }]} horizontal unit="万円" />
        </Box>
        <Box>
          <LineChart title="折れ線(スムーズ・ズーム/ブラシ)" data={monthly} xKey="month" series={[{ key: "売上" }, { key: "費用" }]} smooth unit="万円" toggleable brush />
        </Box>
        <Box>
          <LineChart title="エリアチャート" data={monthly} xKey="month" series={[{ key: "売上" }]} area unit="万円" />
        </Box>
        <Box>
          <ComboChart title="複合(棒+折れ線)売上と利益率" data={monthly} xKey="month"
            series={[{ key: "売上", type: "bar" }, { key: "費用", type: "bar" }, { key: "利益率", type: "line" }]} toggleable />
        </Box>
        <Box>
          <PieChart title="円グラフ(割合ラベル)" data={share} nameKey="name" valueKey="value" showLabels unit="万円" />
        </Box>
        <Box>
          <PieChart title="ドーナツ" data={share} nameKey="name" valueKey="value" donut unit="万円" />
        </Box>
        <Box>
          <RadarChart title="レーダー(A社 vs B社)" data={skills} xKey="項目" series={[{ key: "A", name: "A社" }, { key: "B", name: "B社" }]} toggleable />
        </Box>
        <Box>
          <ScatterChart title="散布図" xLabel="広告費" yLabel="売上"
            series={[{ key: "s1", name: "店舗", points: [{ x: 10, y: 40 }, { x: 20, y: 55 }, { x: 30, y: 52 }, { x: 40, y: 78 }, { x: 50, y: 84 }] }]} />
        </Box>
        <Box>
          <GanttChart title="ガントチャート(プロジェクト)" tasks={[
            { name: "要件定義", start: d(1), end: d(6) },
            { name: "設計", start: d(6), end: d(12) },
            { name: "実装", start: d(10), end: d(24) },
            { name: "テスト", start: d(22), end: d(30) },
          ]} />
        </Box>
        <Box>
          <Heatmap title="ヒートマップ(曜日×時間帯 アクセス)" showValues unit="件"
            data={["月","火","水","木","金"].flatMap((y) => ["朝","昼","夜"].map((x) => ({ x, y, value: Math.round(20 + Math.random() * 80) })))} />
        </Box>
        <Box>
          <Treemap title="ツリーマップ(カテゴリ構成)" data={share.map((s) => ({ name: s.name, size: s.value }))} />
        </Box>
        <Box>
          <FunnelChart title="ファネル(購入までの遷移)" data={[
            { name: "訪問", value: 1000 }, { name: "会員登録", value: 620 }, { name: "カート", value: 340 }, { name: "購入", value: 180 },
          ]} />
        </Box>
        <Box>
          <HorizontalBarChart title="横棒グラフ" data={stacked} xKey="地域" series={[{ key: "文具" }, { key: "食品" }, { key: "家電" }]} stacked unit="万円" toggleable />
        </Box>
        <Box>
          <BandChart title="帯グラフ(構成比100%)" data={stacked} xKey="地域" series={[{ key: "文具" }, { key: "食品" }, { key: "家電" }]} />
        </Box>
        <Box>
          <ChartHistogram title="ヒストグラム(点数分布)" binCount={8}
            values={[42,55,60,61,63,65,66,68,70,70,71,72,73,74,75,75,76,78,80,82,85,88,90,95,52,58,67,69,77,81]} unit="人" />
        </Box>
        <Box>
          <BubbleChart title="バブルチャート(x=広告費 y=売上 大きさ=利益)" xLabel="広告費" yLabel="売上"
            series={[{ key: "b", name: "店舗", points: [{ x: 10, y: 40, z: 20 }, { x: 20, y: 55, z: 60 }, { x: 30, y: 52, z: 35 }, { x: 40, y: 78, z: 90 }, { x: 50, y: 84, z: 50 }] }]} />
        </Box>
        <Box>
          <CandlestickChart title="ローソク足(株価 OHLC)" unit="円" data={[
            { label: "1日", open: 100, high: 110, low: 95, close: 108 },
            { label: "2日", open: 108, high: 112, low: 104, close: 106 },
            { label: "3日", open: 106, high: 107, low: 98, close: 100 },
            { label: "4日", open: 100, high: 105, low: 96, close: 104 },
            { label: "5日", open: 104, high: 118, low: 103, close: 116 },
            { label: "6日", open: 116, high: 120, low: 112, close: 114 },
          ]} />
        </Box>
        <Box>
          <WaterfallChart title="ウォーターフォール(損益内訳)" unit="万円" items={[
            { label: "売上", value: 1000, type: "total" },
            { label: "原価", value: -400 },
            { label: "販管費", value: -200 },
            { label: "その他", value: 50 },
            { label: "営業利益", value: 450, type: "total" },
          ]} />
        </Box>
        <Box>
          <SankeyChart title="サンキー(流入→CV フロー)" data={{
            nodes: [{ name: "検索" }, { name: "広告" }, { name: "サイト訪問" }, { name: "会員登録" }, { name: "購入" }],
            links: [
              { source: 0, target: 2, value: 600 }, { source: 1, target: 2, value: 400 },
              { source: 2, target: 3, value: 620 }, { source: 3, target: 4, value: 180 },
            ],
          }} />
        </Box>
        <Box>
          <div style={{ display: "flex", gap: "1.5rem", alignItems: "center", justifyContent: "center", flexWrap: "wrap" }}>
            <div style={{ textAlign: "center" }}><ProgressRing value={72} /><div style={{ fontSize: ".85rem", color: "var(--color-muted)" }}>達成率</div></div>
            <div style={{ textAlign: "center" }}><ChartGauge value={68} unit="%" /><div style={{ fontSize: ".85rem", color: "var(--color-muted)" }}>稼働率</div></div>
          </div>
        </Box>
        <Box>
          <div style={{ marginBottom: ".75rem", fontSize: ".9rem", fontWeight: 600 }}>CSVエクスポート</div>
          <p style={{ color: "var(--color-muted)", fontSize: ".85rem", marginBottom: ".75rem" }}>月次データを CSV(Excel対応・BOM付き)で出力します。</p>
          <CsvExportButton rows={monthly} filename="月次売上.csv"
            columns={[{ key: "month", header: "月" }, { key: "売上", header: "売上(万円)" }, { key: "費用", header: "費用(万円)" }, { key: "利益率", header: "利益率(%)" }]} />
        </Box>
      </div>
      <p style={{ marginTop: "1.5rem" }}><a href="/">← 戻る</a></p>
    </main>
  );
}
