"use client";
/** WebSocket 実サーバ連携デモ + 差分更新(useLiveSeries)。
 *  先に `pnpm ws:demo`(ルート)で ws://localhost:8080 を起動してください。 */
import { useState, useEffect } from "react";
import { useWebSocket, useLiveSeries, LineChart, Badge, Button, Input } from "@platform/ui";

export default function Page() {
  const [url, setUrl] = useState("ws://localhost:8080");
  const [connectUrl, setConnectUrl] = useState<string | null>(null);
  const { lastMessage, status } = useWebSocket<{ t: number; value: number }>(connectUrl ?? "", { enabled: !!connectUrl });
  const { data, push, reset } = useLiveSeries<{ t: string; 値: number }>(30);

  useEffect(() => {
    if (lastMessage) push({ t: String(lastMessage.t), 値: lastMessage.value });
  }, [lastMessage, push]);

  return (
    <main style={{ maxWidth: 720, margin: "3rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>WebSocket リアルタイム</h1>
      <p style={{ color: "var(--color-muted)", margin: ".5rem 0 1rem", fontSize: ".9rem" }}>
        ルートで <code>pnpm ws:demo</code> を起動 → 「接続」。受信データを直近30点だけ保持して差分更新します。
      </p>
      <div style={{ display: "flex", gap: ".5rem", marginBottom: "1rem" }}>
        <Input value={url} onChange={(e) => setUrl(e.target.value)} style={{ flex: 1 }} />
        {connectUrl
          ? <Button variant="secondary" onClick={() => { setConnectUrl(null); reset(); }}>切断</Button>
          : <Button onClick={() => setConnectUrl(url)}>接続</Button>}
        <Badge variant={status === "open" ? "success" : status === "connecting" ? "warning" : "secondary"}>
          {connectUrl ? status : "未接続"}
        </Badge>
      </div>
      <LineChart data={data} xKey="t" series={[{ key: "値" }]} smooth unit="万円" height={260} showLegend={false} />
      <p style={{ marginTop: "1.5rem" }}><a href="/">← 戻る</a></p>
    </main>
  );
}
