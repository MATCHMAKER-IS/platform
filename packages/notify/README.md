# @platform/notify

通知（メール・Slack・LINE・アプリ内）。

## これは何のためか

**「送ったつもり」が一番困ります。**
直接送ると、失敗したときに**送ったかどうか分かりません**。

このパッケージは **Outbox 経由**で送ります——
**失敗しても再試行され、諦めたときも記録が残ります**。

## 使う前に知っておくこと

| | |
|---|---|
| **何でも通知しない** | **鳴りすぎると見なくなります**。「これが 1 件出たら誰かが動くか」で決めてください |
| **宛先は都度 DB から引く** | 起動時に読み込む形だと、**入社・退職が反映されません** |
| **メモリ実装は 1 台まで** | 2 台構成だと**同じ通知が 2 回届きます**——ロックを Redis 実装へ |
| **本文に個人情報を入れない** | Slack や LINE は**社外の仕組み**です。**「経費が承認されました」で十分**で、金額や氏名は要りません |

## よく使うもの

```ts
import { createSlackChannel, createWebhookChannel } from "@platform/notify";
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

