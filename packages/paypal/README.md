# @platform/paypal

PayPal 決済クライアント(Orders v2)。client_id / client_secret から
アクセストークンを自動取得・キャッシュし、注文の作成・取得・キャプチャ・返金を扱います。

```ts
import { createPayPalClient } from "@platform/paypal";
const paypal = createPayPalClient({ clientId, clientSecret, environment: "sandbox" });
const order = await paypal.createOrder({
  intent: "CAPTURE",
  purchase_units: [{ amount: { currency_code: "JPY", value: "1000" } }],
});
// 承認後
await paypal.captureOrder(order.ok ? order.value.id : "");
```

live / sandbox を切替可能。認証情報の管理はアプリ側で行います。
