"use client";
/**
 * WebSocket リアルタイム更新のデモ。
 *
 * 実サーバに繋ぐ場合は、ルートで `pnpm ws:demo` を起動して ws://localhost:8080 へ接続する。
 * 起動していなくても確かめられるよう、ブラウザ内でデータを作る「模擬モード」を用意している
 * （画面側の差分更新・直近N点の保持・統計は、どちらのモードでも同じ経路を通る）。
 */
import * as React from "react";
import { Alert, Badge, Button, Checkbox, Input, LineChart, Select, useLiveSeries, useWebSocket } from "@platform/ui";

type Point = { t: string; 値: number };

export default function Page() {
  const [url, setUrl] = React.useState("ws://localhost:8080");
  const [connectUrl, setConnectUrl] = React.useState<string | null>(null);
  const [mock, setMock] = React.useState(false);
  const [paused, setPaused] = React.useState(false);
  const [keep, setKeep] = React.useState("30");
  const [received, setReceived] = React.useState(0);
  const [log, setLog] = React.useState<string[]>([]);

  const { lastMessage, status } = useWebSocket<{ t: number; value: number }>(connectUrl ?? "", { enabled: connectUrl !== null });
  const { data, push, reset } = useLiveSeries<Point>(Number(keep));

  const add = React.useCallback((t: number, value: number) => {
    setReceived((n) => n + 1);
    setLog((l) => [`${new Date(t).toLocaleTimeString()}  ${value.toFixed(1)}`, ...l].slice(0, 8));
    push({ t: String(t), 値: value });
  }, [push]);

  // 実サーバからの受信
  React.useEffect(() => {
    if (lastMessage && !paused) add(lastMessage.t, lastMessage.value);
  }, [lastMessage, paused, add]);

  // 模擬モード: ランダムウォークで値を作る
  React.useEffect(() => {
    if (!mock || paused) return;
    let v = 100;
    const id = window.setInterval(() => {
      v = Math.max(0, v + (Math.random() - 0.48) * 8);
      add(Date.now(), v);
    }, 700);
    return () => window.clearInterval(id);
  }, [mock, paused, add]);

  const values = data.map((d) => d.値);
  const stat = values.length === 0 ? null : {
    last: values[values.length - 1]!,
    min: Math.min(...values),
    max: Math.max(...values),
    avg: values.reduce((a, b) => a + b, 0) / values.length,
  };

  const live = mock || status === "open";
  const clearAll = () => { reset(); setReceived(0); setLog([]); };

  return (
    <main style={{ maxWidth: 780, margin: "2.5rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 6 }}>WebSocket リアルタイム</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted)", marginBottom: 16 }}>
        受信のたびに直近 N 点だけを保持して差分更新します。実サーバに繋ぐにはルートで <code>pnpm ws:demo</code> を起動してください。
        起動していない場合は「模擬モード」で同じ動きを確認できます。
      </p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        <Input value={url} onChange={(e) => setUrl(e.target.value)} disabled={mock} style={{ flex: "1 1 220px" }} aria-label="接続先URL" />
        {connectUrl !== null
          ? <Button variant="secondary" onClick={() => { setConnectUrl(null); clearAll(); }}>切断</Button>
          : <Button onClick={() => setConnectUrl(url)} disabled={mock}>接続</Button>}
        <Badge variant={live ? "success" : status === "connecting" ? "warning" : "secondary"}>
          {mock ? "模擬" : connectUrl !== null ? status : "未接続"}
        </Badge>
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 16 }}>
        <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
          <Checkbox  checked={mock} onCheckedChange={(v) => { setMock(!!v); if (!!v) { setConnectUrl(null); } clearAll(); }} />
          模擬モード（サーバ不要）
        </label>
        <label style={{ display: "grid", gap: 4, fontSize: 12, color: "var(--color-muted)" }}>保持する点数
          <Select value={keep} onChange={(e) => { setKeep(e.target.value); clearAll(); }}
            options={["20", "30", "60", "120"].map((v) => ({ label: `${v} 点`, value: v }))} />
        </label>
        <Button size="sm" variant="secondary" onClick={() => setPaused((p) => !p)} disabled={!mock && status !== "open"}>
          {paused ? "再開" : "一時停止"}
        </Button>
        <Button size="sm" variant="secondary" onClick={clearAll} disabled={received === 0}>消去</Button>
      </div>

      {!mock && connectUrl !== null && status !== "open" && (
        <div style={{ marginBottom: 16 }}>
          <Alert variant="warning" title="接続できていません">
            ルートで <code>pnpm ws:demo</code> を起動しているか確認してください。すぐ確かめたい場合は「模擬モード」を使えます。
          </Alert>
        </div>
      )}

      <LineChart data={data} xKey="t" series={[{ key: "値" }]} smooth unit="万円" height={260} showLegend={false} />

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
        <span style={chip}>受信 {received} 件</span>
        <span style={chip}>表示 {data.length} / {keep} 点</span>
        {stat && <>
          <span style={chip}>最新 {stat.last.toFixed(1)}</span>
          <span style={chip}>最小 {stat.min.toFixed(1)}</span>
          <span style={chip}>最大 {stat.max.toFixed(1)}</span>
          <span style={chip}>平均 {stat.avg.toFixed(1)}</span>
        </>}
      </div>

      {log.length > 0 && (
        <div style={{ marginTop: 16, border: "1px solid var(--color-border)", borderRadius: "var(--radius)", background: "var(--color-surface)", padding: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>直近の受信</div>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, fontFamily: "monospace", fontSize: 11.5, lineHeight: 1.9 }}>
            {log.map((l, i) => <li key={i} style={{ color: i === 0 ? "var(--color-fg)" : "var(--color-muted)" }}>{l}</li>)}
          </ul>
        </div>
      )}

      <p style={{ fontSize: 12, color: "var(--color-muted)", lineHeight: 1.8, marginTop: 16 }}>
        <code>useWebSocket</code> が接続状態の管理（接続・切断・再接続）を、<code>useLiveSeries</code> が
        直近 N 点だけを保持する差分更新を担当します。全件を保持し続けると、長時間開いた画面が重くなります。
      </p>
    </main>
  );
}

const chip: React.CSSProperties = { fontSize: 12, padding: "4px 10px", borderRadius: 999, border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-muted)" };
