# @platform/realtime

自動更新の基盤(ポーリング・再接続 WebSocket)。フレームワーク非依存。

```ts
import { createPoller, createReconnectingWebSocket } from "@platform/realtime";

const poller = createPoller(() => refreshData(), 5000);
poller.start(); // 5秒ごと(開始時に即時1回)。poller.stop() で停止。

const ws = createReconnectingWebSocket("wss://example/stream", {
  onMessage: (data) => update(data),   // JSON は自動 parse
});
// 切断時は指数バックオフで自動再接続。ws.close() で明示切断。
```

React では `@platform/ui` の `usePolling` / `useWebSocket` を使うと状態管理まで込みで扱えます。
