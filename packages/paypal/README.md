# @platform/paypal

PayPal 決済（注文・返金）。**海外の取引先やカードを持たない相手からの入金**に使います。

## これは何のためか

**海外の取引先や、カードを持たない相手からの入金**に使います。

## 使う前に知っておくこと

| | |
|---|---|
| **既定は `sandbox` です** | **`live` にすると本番の PayPal に繋がり、実際に決済が走ります**——テストのつもりで本物を動かさないでください |
| **返金は全額とは限りません** | 一部返金があります——**元の金額と突き合わせて**ください |
| **通貨を必ず確認する** | 円だと思ったらドルだった、は**額が 100 倍以上違います** |
| **Webhook の署名を検証する** | しないと、**「入金がありました」と誰でも偽れます** |
| **決済の記録は必ず残す** | 「払ったはず」の問い合わせに、**PayPal の画面を見に行かずに答えられる**ようにしてください |

## よく使うもの

```ts
import { createPayPalClient } from "@platform/paypal";
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
