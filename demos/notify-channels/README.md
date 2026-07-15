# @demos/notify-channels — 通知の実チャネル接続

`@platform/notify` の `NotifyChannel` として、メール（`@platform/mail`）・Slack（Webhook）・LINE を送れるようにするアダプタ集。
- `mailChannel(mailer, to)` — `level` に応じて件名に【重要】【注意】を付与。
- `slackChannel(webhookUrl, post)` — Webhook へ POST（`post` は fetch を注入）。
- `lineChannel(to, pushText)` — LINE プッシュ送信を注入。

```ts
import { createNotifier } from "@platform/notify";
import { mailChannel, slackChannel } from "@demos/notify-channels";

const notifier = createNotifier([
  mailChannel(mailer, "team@example.com", { subjectPrefix: "承認依頼" }),
  slackChannel(process.env.SLACK_WEBHOOK!, (url, body) => fetch(url, { method: "POST", body: JSON.stringify(body) }).then((r) => ({ ok: r.ok }))),
]);
await notifier.notify({ text: "経費申請の承認をお願いします", level: "info" });
```
承認フロー（blueprint-workflow の `notificationFor`）が生成したメッセージを、実チャネルへ流せます。
