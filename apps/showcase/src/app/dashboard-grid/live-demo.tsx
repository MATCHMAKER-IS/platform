"use client";
/** DnD配置+localStorage保存のダッシュボード、ポーリング自動更新チャートのデモ。 */
import {
  DraggableDashboard, useDashboardLayout, createLocalStorageLayoutStore,
  usePolling, LineChart, StatCard, Button, Badge,
} from "@platform/ui";

const store = createLocalStorageLayoutStore("demo-dashboard-layout");
const DEFAULT = [
  { id: "kpi", colSpan: 4 }, { id: "kpi2", colSpan: 4 }, { id: "kpi3", colSpan: 4 },
  { id: "live", colSpan: 12 },
];
const TITLES: Record<string, string> = { kpi: "売上", kpi2: "注文", kpi3: "在庫", live: "リアルタイム売上" };

// 擬似APIフェッチ(ランダム値)
let t = 0;
const series: { t: string; 値: number }[] = [];
async function fetchLatest() {
  await new Promise((r) => setTimeout(r, 120));
  t += 1;
  series.push({ t: `${t}`, 値: Math.round(400 + Math.random() * 200) });
  if (series.length > 20) series.shift();
  return [...series];
}

export function LiveDashboardDemo() {
  const { layout, setLayout, reset } = useDashboardLayout(DEFAULT, store);
  const { data, loading, refresh } = usePolling(fetchLatest, 2000);

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: ".75rem", marginBottom: "1rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>ライブダッシュボード</h1>
        <Badge variant={loading ? "warning" : "success"}>{loading ? "更新中" : "自動更新 2秒"}</Badge>
        <div style={{ marginLeft: "auto", display: "flex", gap: ".5rem" }}>
          <Button variant="secondary" onClick={refresh}>今すぐ更新</Button>
          <Button variant="secondary" onClick={reset}>レイアウト初期化</Button>
        </div>
      </div>
      <p style={{ color: "var(--color-muted)", marginBottom: "1rem", fontSize: ".9rem" }}>
        ウィジェットはドラッグで並べ替え、右端をドラッグで幅変更。配置は localStorage に自動保存されます(リロードしても復元)。
      </p>

      <DraggableDashboard
        layout={layout}
        onLayoutChange={setLayout}
        titleOf={(id) => TITLES[id]}
        renderWidget={(id) => {
          if (id === "live") {
            return <LineChart data={data ?? []} xKey="t" series={[{ key: "値" }]} smooth unit="万円" height={220} showLegend={false} />;
          }
          const v = { kpi: "¥6,100,000", kpi2: "128件", kpi3: "342点" }[id] ?? "-";
          const d = { kpi: "+8.9%", kpi2: "+12", kpi3: "-5" }[id];
          return <StatCard label={TITLES[id]} value={v} delta={d} trend={id === "kpi3" ? "down" : "up"} />;
        }}
      />
      <p style={{ marginTop: "1.5rem" }}><a href="/">← 戻る</a></p>
    </>
  );
}
