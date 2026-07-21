"use client";
/** グラフ(チャート)デモ。全種+主要オプション。 */
import { BarChart, LineChart, ComboChart, PieChart, RadarChart, ScatterChart, GanttChart, Heatmap, Treemap, FunnelChart, CandlestickChart, BubbleChart, BandChart, ChartHistogram, HorizontalBarChart, WaterfallChart, SankeyChart, ChartGauge, ProgressRing, CsvExportButton, withMovingAverage, summarizeCandles, toCandles, regressionLine, fitStrength } from "@platform/ui";

// 散布図(広告費と売上)。**回帰直線も基盤に任せる**。
const ads = [
  { x: 10, y: 40 }, { x: 20, y: 55 }, { x: 30, y: 52 },
  { x: 40, y: 78 }, { x: 50, y: 84 }, { x: 60, y: 91 }, { x: 70, y: 105 },
];
const adsFit = regressionLine(ads);
// 関係が無い例(R² が低いと、直線を引いても意味がないと分かる)
const noise = [
  { x: 1, y: 12 }, { x: 2, y: 31 }, { x: 3, y: 8 }, { x: 4, y: 27 },
  { x: 5, y: 15 }, { x: 6, y: 33 }, { x: 7, y: 11 },
];
const noiseFit = regressionLine(noise);

// 日次の在庫推移(OHLC)。株価でなくても「1 期間の始値/高値/安値/終値」は使える。
const stock = [
  { label: "7/1", open: 100, high: 110, low: 95, close: 108 },
  { label: "7/2", open: 108, high: 112, low: 104, close: 106 },
  { label: "7/3", open: 106, high: 107, low: 98, close: 100 },
  { label: "7/4", open: 100, high: 105, low: 96, close: 104 },
  { label: "7/5", open: 104, high: 118, low: 103, close: 116 },
  { label: "7/6", open: 116, high: 120, low: 112, close: 114 },
  { label: "7/7", open: 114, high: 116, low: 105, close: 107 },
  { label: "7/8", open: 107, high: 113, low: 106, close: 112 },
  { label: "7/9", open: 112, high: 122, low: 111, close: 121 },
  { label: "7/10", open: 121, high: 124, low: 117, close: 118 },
];
// **移動平均は基盤に任せる**。自前で movingAverage を呼ぶと window-1 本ぶん日付がずれる。
const stockWithMa = withMovingAverage(stock, 5);
const stockSummary = summarizeCandles(stock);
// 1 日 1 件の数値 → 週足(5 件で 1 本)。端数は捨てない。
const weekly = toCandles(
  [42, 38, 51, 47, 56, 44, 39, 61, 58, 53, 49, 67].map((v, i) => ({ label: `${i + 1}日`, value: v })),
  5,
);

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
          <ScatterChart title="散布図(そのまま)" xLabel="広告費(万円)" yLabel="売上(万円)"
            series={[{ key: "s1", name: "店舗", points: ads }]} />
          <div style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 6 }}>
            点を見て「なんとなく右肩上がり」までは分かりますが、<b>どのくらいかは言えません</b>。
          </div>
        </Box>
        <Box>
          <ScatterChart title="散布図 + 回帰直線（showRegression）" xLabel="広告費(万円)" yLabel="売上(万円)"
            showRegression
            series={[{ key: "s1", name: "店舗", points: ads }]} />
          <div style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 6, lineHeight: 1.7 }}>
            <b>{adsFit?.equation}</b>（R²={adsFit?.r2.toFixed(2)} = 当てはまりは
            <b>{adsFit ? fitStrength(adsFit.r2) : "—"}</b>）。
            広告費を 1 万円増やすと売上が約 <b>{adsFit?.slope.toFixed(1)}</b> 万円増える、と読めます。
            <br />
            <code>showRegression</code> は<b>既定 false</b>のオプションです。凡例に式と R² が出ます。
          </div>
        </Box>
        <Box>
          <ScatterChart title="回帰が意味を持たない例" xLabel="社員番号" yLabel="残業時間"
            showRegression
            series={[{ key: "noise", name: "ばらつき", points: noise }]} />
          <div style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 6, lineHeight: 1.7 }}>
            R²={noiseFit?.r2.toFixed(2)} =「<b>{noiseFit ? fitStrength(noiseFit.r2) : "—"}</b>」。
            <b>直線は引けても、関係があるとは限りません。</b>
            R² を見ずに「傾きがプラスだから相関がある」と言うのが、一番ありがちな誤読です。
          </div>
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
          <CandlestickChart title="ローソク足(OHLC) + 5日移動平均" unit="個" maWindow={5} data={stockWithMa} />
          <div style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 6, lineHeight: 1.7 }}>
            日次の在庫推移。<b>陽線 {stockSummary.bullish}</b> / 陰線 {stockSummary.bearish}、
            高 {stockSummary.high} / 安 {stockSummary.low}、
            変化率 <b>{stockSummary.changePercent.toFixed(1)}%</b>、平均値幅 {stockSummary.averageRange.toFixed(1)}。
            移動平均は <code>withMovingAverage()</code> で<b>長さを揃えて</b>います（先頭4本は線が出ません）。
          </div>
        </Box>
        <Box>
          <CandlestickChart title="日次の受注金額を週足にまとめる" unit="万円" data={weekly} height={280} />
          <div style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 6, lineHeight: 1.7 }}>
            <b>1 日 1 件の数値しか無くても</b>、<code>toCandles(points, 5)</code> で週ごとにまとめると
            「その週にどれだけ振れたか」が見えます。<b>端数は捨てません</b>（最後の週が短くても 1 本になります）。
          </div>
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
