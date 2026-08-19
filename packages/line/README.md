# @platform/line

LINE 公式アカウント（通知・承認・リッチメニュー・受信）。

## これは何のためか

**出先の人は PC を開けません。**

「承認待ちが溜まって業務が止まる」のは、
**承認者が席にいないだけ**のことが多く、**スマホで押せれば数秒**で終わります。

## 使う前に知っておくこと

| | |
|---|---|
| **署名の検証を必ず** | 検証しないと、**誰でも「LINE から来た」と偽って送れます** |
| **押した人を `postback` のデータで決めない** | データは**利用者側で作れます**——`userId=admin` と偽れます。**署名で確認した `userId`** を使ってください |
| **リッチメニューは画像が必須** | 無いと**表示されません**（作成しただけでは何も起きず、「設定したのに出ない」状態） |
| **画像は `api-data.line.me` へ** | 他の API とは**別のドメイン**です——間違えると **404** で原因が分かりにくい |
| **送信数に上限があります** | 従量課金です。`getQuotaConsumption` で**今月いくつ使ったか**を見てください |
| **受け取った画像はすぐ写す** | LINE 側は**一定期間で消します**——「あとで取りに行く」は失敗します |

## よく使うもの

```ts
import { createLineClient, approvalFlexMessage, buildRichMenu } from "@platform/line";
import { createLineClient, buttonsTemplate, postbackAction } from "@platform/line";

const line = createLineClient({ channelAccessToken: env.LINE_CHANNEL_ACCESS_TOKEN });

// リッチな承認依頼(ボタンテンプレート)
await line.push("U1234...", [buttonsTemplate({
  altText: "承認依頼", title: "経費申請", text: "承認しますか?",
  actions: [postbackAction("承認", "action=approve&id=1"), postbackAction("却下", "action=reject&id=1")],
})]);
```

## メッセージビルダー(手書き JSON 不要)
`textMessage`/`imageMessage`/`stickerMessage`/`locationMessage`、テンプレート
(`buttonsTemplate`/`confirmTemplate`/`carouselTemplate`)、`flexMessage`、`withQuickReply`。

## Webhook 受信(双方向連携)
```ts
import { verifyLineSignature, parseLineWebhook, parsePostbackData } from "@platform/line";

if (!verifyLineSignature(rawBody, req.headers["x-line-signature"], env.LINE_CHANNEL_SECRET)) return;
for (const event of parseLineWebhook(rawBody)) {
  if (event.type === "postback") {
    const { action, id } = parsePostbackData(event.postback.data); // ボタン押下を処理
  }
}
```
LINE の署名は base64(汎用 `@platform/webhook` の hex とは別)なので専用関数を使います。

## リッチメニュー・その他
`createRichMenu`/`linkRichMenu`/`setDefaultRichMenu`/`deleteRichMenu`、
`showLoadingAnimation`(応答準備中の演出)、`getMessageQuota`、`getGroupMemberProfile`。

単純な通知だけなら `@platform/notify` の LINE チャネルで十分です。
