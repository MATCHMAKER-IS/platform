# @platform/stripe

> **⚠️ incubating(2026-08 に使用状況を確認)。** `internal-app` を含む
> どのアプリからも使われていない(`grep` で使用箇所ゼロを確認)。
> `@platform/commerce`(EC 機能)と同じ判断——社内業務システムに
> **顧客向けカード決済は不要**。立替精算の返金など、将来カード決済を
> 検討する場面が出てくれば実アプリで使ってから `stable` に上げること
> (先に上げないのが `check-package-tier` の不変条件)。
Stripe 決済（支払い・返金・Webhook）。

## これは何のためか

**カード決済**のためのものです。
公式 SDK の**薄い包み**で、必要な部分だけを扱いやすくしています。

## 使う前に知っておくこと

| | |
|---|---|
| **`fetch` を差し替えられません** | 公式 SDK を使うためです——**契約テストが効かない**ので、**動作確認は Stripe のテスト環境**で行ってください |
| **Webhook の署名を検証する** | しないと、**「決済が成功しました」と誰でも偽れます**——**金額を書き換えられます** |
| **金額は最小単位** | 円なら**円**、ドルなら**セント**です——**ドルで `100` は 1 ドル**です |
| **テストキーと本番キーを混ぜない** | `sk_test_` と `sk_live_` です。**接頭辞で見分けられます** |
| **返金には期限があります** | 通常 180 日です——**それ以降は銀行振込**などで対応することになります |

## よく使うもの

```ts
import { createStripeClient } from "@platform/stripe";
import { createStripeClient } from "@platform/stripe";
const stripe = createStripeClient({ secretKey: env.STRIPE_SECRET_KEY });

// 決済
const res = await stripe.createPaymentIntent({ amount: 1000, currency: "jpy" });

// Webhook 署名検証(改ざん・不正リクエストを弾く)
const evt = stripe.verifyWebhook(rawBody, req.headers["stripe-signature"], env.STRIPE_WEBHOOK_SECRET);
```

form エンコードや署名検証など独自要件があるため、自前 HTTP ではなく公式 SDK を採用しています。
シークレットキーの管理はアプリ側で行います。
