# @platform/webhook

Webhook 受信の共通枠組み。外部サービス(Stripe/Zoho/LINE/GitHub 等)からの Webhook を
「署名検証 → 冪等(重複配送を1回に)→ イベントディスパッチ」の定番処理で安全に受けます。

```ts
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
