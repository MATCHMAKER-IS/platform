"use client";
/** 数値可視化デモ: Sparkline / Histogram / StatSummary / 外れ値 / 整形。 */
import { Sparkline, Histogram, StatSummary, BoxPlot, Trend, Gauge, KpiCard, Scatter, TimelineChart, MetricGrid } from "@platform/ui";
import { formatManOku, formatCompact, formatBytes, formatRange, outliers, movingAverage, trend, linearRegression, regressionBand, decompose, dominantLag } from "@platform/utils";

const SALES = [120, 135, 128, 150, 142, 160, 155, 170, 168, 180, 175, 210];
const SAMPLE = [12, 14, 15, 15, 16, 16, 17, 18, 18, 19, 20, 21, 22, 24, 60];

export default function Page() {
  const ma = movingAverage(SALES, 3);
  return (
    <main style={{ maxWidth: 760, margin: "2.5rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "1rem" }}>数値ユーティリティ</h1>

      <section style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontWeight: 700, marginBottom: ".5rem" }}>KPI カード(複合)</h2>
        <MetricGrid minWidth={200}>
          <KpiCard label="月次売上" value={SALES[SALES.length - 1] ?? 0} previous={SALES[SALES.length - 2] ?? 0} series={SALES} suffix="万円" />
          <KpiCard label="コスト" value={92} previous={100} higherIsBetter={false} suffix="万円" />
          <KpiCard label="達成率" value={88} previous={80} suffix="%" />
        </MetricGrid>
      </section>

      <section style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontWeight: 700, marginBottom: ".5rem" }}>散布図 + 回帰 + 相関</h2>
        <Scatter points={SALES.map((v, i) => ({ x: i, y: v }))} width={360} height={200} showRegression showCorrelation />
      </section>

      <section style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontWeight: 700, marginBottom: ".5rem" }}>時系列チャート(実績 + 3ヶ月移動平均 + 予測バンド)</h2>
        <TimelineChart
          width={520}
          height={240}
          xLabels={["1月", "4月", "7月", "10月", "12月"]}
          showTooltip
          formatX={(x) => `${x + 1}月`}
          formatY={(y) => `${Math.round(y)}万`}
          series={[
            { name: "実績", points: SALES.map((v, i) => ({ x: i, y: v })), showArea: true },
            { name: "移動平均(3)", color: "#f59e0b", points: movingAverage(SALES, 3).map((v, i) => ({ x: i + 2, y: v })) },
          ]}
          band={{ points: regressionBand(SALES.map((_, i) => i), SALES, { kind: "prediction" }).map((b) => ({ x: b.x, lower: b.lower, upper: b.upper })) }}
        />
        <p style={{ fontSize: ".8rem", color: "var(--color-muted)", marginTop: ".25rem" }}>帯は単回帰の予測区間(95%・正規近似)。</p>
      </section>

      <section style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontWeight: 700, marginBottom: ".5rem" }}>季節性分解(period=4)</h2>
        {(() => {
          const seasonal = [10, -5, -10, 5];
          const data = Array.from({ length: 24 }, (_, i) => 100 + 2 * i + (seasonal[i % 4] ?? 0));
          const d = decompose(data, 4);
          return (
            <TimelineChart
              width={520}
              height={220}
              showLegend
              series={[
                { name: "元系列", points: data.map((v, i) => ({ x: i, y: v })) },
                { name: "トレンド", color: "#ef4444", points: d.trend.map((v, i) => ({ x: i, y: v })).filter((p) => p.y != null) as { x: number; y: number }[] },
                { name: "季節成分", color: "#10b981", points: d.seasonal.map((v, i) => ({ x: i, y: 100 + v })) },
              ]}
            />
          );
        })()}
        <p style={{ fontSize: ".8rem", color: "var(--color-muted)", marginTop: ".25rem" }}>元系列=トレンド(中心化移動平均)+季節成分+残差。季節成分は +100 オフセットで表示。自己相関で推定した周期: {dominantLag(Array.from({ length: 24 }, (_, i) => 100 + 2 * i + ([10, -5, -10, 5][i % 4] ?? 0)), 8)}</p>
      </section>

      <section style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontWeight: 700, marginBottom: ".5rem" }}>スパークライン(月次売上)</h2>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <Sparkline values={SALES} width={220} height={44} showArea showLastDot />
          <div style={{ fontSize: ".9rem", color: "var(--color-muted)" }}>
            直近: {SALES[SALES.length - 1]} / 3ヶ月移動平均: {ma[ma.length - 1]?.toFixed(1)}
          </div>
        </div>
      </section>

      <section style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontWeight: 700, marginBottom: ".5rem" }}>ヒストグラム(サンプル分布)</h2>
        <Histogram values={SAMPLE} bins={6} height={120} />
      </section>

      <section style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontWeight: 700, marginBottom: ".5rem" }}>要約統計 + 外れ値</h2>
        <StatSummary values={SAMPLE} />
        <p style={{ fontSize: ".85rem", color: "var(--color-muted)", marginTop: ".5rem" }}>外れ値(IQR法): {outliers(SAMPLE).join(", ") || "なし"}</p>
      </section>

      <section style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontWeight: 700, marginBottom: ".5rem" }}>箱ひげ図 / 前期比 / 達成率</h2>
        <div style={{ marginBottom: ".75rem" }}><BoxPlot values={SAMPLE} width={340} height={64} /></div>
        <div style={{ display: "flex", alignItems: "center", gap: "2rem", flexWrap: "wrap" }}>
          <div>売上 {SALES[SALES.length - 1] ?? 0} <Trend current={SALES[SALES.length - 1] ?? 0} previous={SALES[SALES.length - 2] ?? 0} /></div>
          <div>コスト <Trend current={92} previous={100} higherIsBetter={false} /></div>
          <Gauge value={SALES[SALES.length - 1] ?? 0} target={200} />
          <div style={{ fontSize: ".85rem", color: "var(--color-muted)" }}>回帰の傾き: {linearRegression(SALES).slope.toFixed(2)} / トレンド: {trend(SALES).direction}</div>
        </div>
      </section>

      <section>
        <h2 style={{ fontWeight: 700, marginBottom: ".5rem" }}>整形</h2>
        <ul style={{ fontSize: ".9rem", lineHeight: 1.9 }}>
          <li>万億: {formatManOku(123456789)} / 短縮: {formatCompact(3450000)}</li>
          <li>バイト: {formatBytes(1536000)} / 範囲: {formatRange(1000, 5000, { prefix: "¥" })}</li>
        </ul>
      </section>

      <p style={{ marginTop: "1.5rem" }}><a href="/">← 戻る</a></p>
    </main>
  );
}
