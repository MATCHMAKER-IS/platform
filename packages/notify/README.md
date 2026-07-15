# @platform/notify

チャット通知の共通部品(Adapter パターン)。業務イベントの通知に使います。

- `createSlackChannel(webhookUrl)`
- `createTeamsChannel(webhookUrl)`
- `createLineChannel(channelAccessToken)`

```ts
import { createNotifier, createSlackChannel } from "@platform/notify";
const notifier = createNotifier([createSlackChannel(env.SLACK_WEBHOOK_URL)]);
await notifier.notify({ text: "夜間バッチが失敗しました", level: "error" });
```

複数チャネルへの同報も可能です。

## 通知プレファレンス(ユーザー設定)
ユーザーごとに「どのイベントをどのチャネルで・即時かまとめてか」を設定し、静音時間も扱えます。
```ts
import { resolveDelivery, partitionDeliveries } from "@platform/notify";

const pref = {
  categories: {
    approval: { channels: ["slack", "email"], mode: "immediate" },
    report: { channels: ["email"], mode: "digest" },   // まとめ通知に回す
    marketing: { channels: ["email"], mode: "off" },   // 受け取らない
  },
  quietHours: { start: 22, end: 7 },  // 夜間は緊急以外配信しない
};

const d = resolveDelivery(pref, { category: "approval" });
if (!d.deferred) sendTo(d.channels, message);  // d.channels = ["slack","email"]
```
一括処理は `partitionDeliveries`(即時/ダイジェスト/抑制に振り分け)、まとめ本文は `summarizeDigest`
(カテゴリ別件数)で。緊急イベント(urgent)は静音時間・digest を無視して即時配信します。すべて純ロジック。

