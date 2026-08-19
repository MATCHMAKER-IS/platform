# @platform/webhook

Webhook の受信（署名検証・再送対応）。

## これは何のためか

**外部サービスからの通知を、安全に受ける**ためのものです。

「決済が成功しました」「承認されました」——
**検証しないと、誰でも偽れます**。

## 使う前に知っておくこと

| | |
|---|---|
| **署名を必ず検証する** | しないと、**「1 億円の入金がありました」と誰でも送れます** |
| **パースする前の生の文字列で検証** | JSON にしてから戻すと、**空白や順序が変わって署名が合いません** |
| **比較はタイミング安全に** | 普通の比較だと、**応答時間の差から署名を推測**されます |
| **同じ通知が 2 回来ます** | 外部サービスは**応答が返らないと再送**します——**冪等キー**で二重処理を防いでください |
| **すぐ 200 を返す** | 重い処理をしてから返すと、**タイムアウトで再送**されます——**受けたら即座に返し、処理は後で** |

## よく使うもの

```ts
import { verifySignedAt, verifyHmacSignature, createMemoryWebhookStore } from "@platform/webhook";
import { createWebhookReceiver } from "@platform/webhook";

const receiver = createWebhookReceiver({
  secret: env.WEBHOOK_SECRET, signaturePrefix: "sha256=",
  parse: JSON.parse, eventId: (e) => e.id, eventType: (e) => e.type,
});
receiver.on("payment.succeeded", async (e) => { await markPaid(e); });

const result = await receiver.handle(rawBody, req.headers["x-signature"]);
// result.status: processed | duplicate | invalid_signature | unhandled
```

署名は HMAC(タイミング安全比較)。冪等ストアは注入可(`@platform/observability` の Idempotency 等)。
