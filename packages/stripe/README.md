# @platform/stripe

Stripe 決済クライアント(公式 `stripe` SDK ラッパー)。

```ts
import { createStripeClient } from "@platform/stripe";
const stripe = createStripeClient({ secretKey: env.STRIPE_SECRET_KEY });

// 決済
const res = await stripe.createPaymentIntent({ amount: 1000, currency: "jpy" });

// Webhook 署名検証(改ざん・不正リクエストを弾く)
const evt = stripe.verifyWebhook(rawBody, req.headers["stripe-signature"], env.STRIPE_WEBHOOK_SECRET);
```

form エンコードや署名検証など独自要件があるため、自前 HTTP ではなく公式 SDK を採用しています。
シークレットキーの管理はアプリ側で行います。
