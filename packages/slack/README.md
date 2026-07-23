# @platform/slack

Slack の Web API と、Slack **からの受信**（イベント・スラッシュコマンド）の署名検証。

> **一方向に通知を送るだけなら `@platform/notify` の `createSlackChannel`（Incoming Webhook）で足ります。**
> こちらは、スレッド返信・メッセージ更新・利用者の照会・受信が必要な場合に使います。

```ts
import { createSlackClient, verifySlackSignature } from "@platform/slack";

const slack = createSlackClient(process.env.SLACK_BOT_TOKEN);
const posted = await slack.postMessage({ channel: "#経理", text: "月次締めを開始します" });
await slack.postMessage({ channel: posted.channel, threadTs: posted.ts, text: "完了しました" });
```

## 注意する点

| 点 | 内容 |
|---|---|
| **HTTP 200 でも失敗する** | Slack は本文の `ok` が false で失敗を返す。ステータスだけ見ていると気づけない（この層で確認済み） |
| **受信は必ず署名を検証する** | 検証していない受信口は「社内システムを外部から操作できる穴」になる |
| **生ボディで検証する** | JSON にパースしてから戻すと空白や順序が変わり、一致しなくなる |
| **時刻も署名に含まれる** | 5 分より古い要求は弾かれる（使い回しの防止） |

## 承認をチャットで回す

```ts
import { buildApprovalBlocks, parseInteraction, verifySlackSignature } from "@platform/slack";

// 送る側
await slack.postMessage({
  channel: "#承認", text: "経費申請の承認",
  blocks: buildApprovalBlocks({ title: "経費申請の承認", summary: "山田太郎 / 12,000円", actionValue: "expense:123" }),
});

// 受ける側（署名検証のあと）
const it = parseInteraction(body);
// ★ 押した人が承認権限を持つかを必ず確かめる（Slack のユーザー ID と社内利用者を突き合わせる）
```

却下ボタンには確認を挟みます（押し間違いが申請者に通知されるため）。

## 権限（スコープ）

使う操作の分だけ要求します。`chat:write`（投稿）、`chat:write.public`（未参加チャンネルへの投稿）、
`users:read.email`（メールから利用者を引く）など。
