# @platform/slack

Slack 連携（通知・承認ボタン・ファイル送信）。

## これは何のためか

**承認や障害の知らせを、見る場所に流す**ためのものです。
メールは埋もれますが、**Slack は見ています**。

## 使う前に知っておくこと

| | |
|---|---|
| **Webhook の URL は秘密です** | 漏れると**誰でもその部屋に投稿できます**。`.env` に置き、**コードに書かないでください** |
| **署名の検証を必ず** | ボタンの押下を受けるときは、**Slack から来たことを確かめて**ください |
| **何でも通知しない** | **鳴りすぎると見なくなります**。「これが 1 件出たら誰かが動くか」で決めてください |
| **ファイル送信は 3 段階** | **③まで通って初めて成功**です——途中で止まると、**送ったつもりなのに誰にも見えません** |
| **本文に個人情報を入れない** | Slack は**社外の仕組み**です。「経費が承認されました」で十分です |

## よく使うもの

```ts
import { createSlackClient, buildApprovalBlocks, verifySlackSignature } from "@platform/slack";
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
