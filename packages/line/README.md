# @platform/line

LINE Messaging API の総合クライアント + メッセージビルダー + Webhook 受信。
送信(push/multicast/broadcast/reply)に加え、リッチメニュー・双方向連携まで扱えます。

```ts
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
