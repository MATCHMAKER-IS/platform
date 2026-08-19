# @platform/realtime

リアルタイム通信（SSE・購読）。**画面を更新せずに届けます**。

## これは何のためか

**「更新ボタンを押さないと出ない」を無くす**ためのものです。

承認された、新しい通知が来た——**その場で分かります**。

## 使う前に知っておくこと

| | |
|---|---|
| **このハブは認可を見ません** | **誰に届けてよいかは、呼び出し側で判断**してください——**全員に流すと、見えてはいけないものが見えます** |
| **環境ごとに分ける** | 開発と本番で同じチャネルを使うと、**開発の通知が本番の画面に出ます** |
| **繋ぎっぱなしは資源を使います** | 100 人が開いていれば**100 本の接続**です——**タブを閉じたら切る**ようにしてください |
| **届かないことがあります** | 回線が切れれば落ちます——**重要なものは通知（`@platform/notify`）と併用**してください |

## よく使うもの

```ts
import { createBroadcastHub, backoffDelay, createPoller } from "@platform/realtime";
import { createPoller, createReconnectingWebSocket } from "@platform/realtime";

const poller = createPoller(() => refreshData(), 5000);
poller.start(); // 5秒ごと(開始時に即時1回)。poller.stop() で停止。

const ws = createReconnectingWebSocket("wss://example/stream", {
  onMessage: (data) => update(data),   // JSON は自動 parse
});
// 切断時は指数バックオフで自動再接続。ws.close() で明示切断。
```

React では `@platform/ui` の `usePolling` / `useWebSocket` を使うと状態管理まで込みで扱えます。
