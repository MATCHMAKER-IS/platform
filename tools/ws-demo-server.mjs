/**
 * WebSocket デモサーバ。1 秒ごとにランダムな指標をブロードキャストする。
 * 実行: `node tools/ws-demo-server.mjs`(要 `pnpm add -w ws`)
 * デモページ /ws から ws://localhost:8080 に接続して受信を確認できます。
 */
import { WebSocketServer } from "ws";

const port = Number(process.env.WS_PORT ?? 8080);
const wss = new WebSocketServer({ port });
console.log(`WebSocket demo server: ws://localhost:${port}`);

let t = 0;
setInterval(() => {
  t += 1;
  const payload = JSON.stringify({ t, value: Math.round(400 + Math.random() * 200), at: new Date().toISOString() });
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(payload);
  }
}, 1000);
