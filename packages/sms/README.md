# @platform/sms

SMS の送信（Twilio）。**電話番号だけで届きます**。

## これは何のためか

**メールを見ない人にも届く**ためのものです。

現場の作業者、外部の協力会社——
**メールアドレスを持たない相手**にも連絡できます。

## 使う前に知っておくこと

| | |
|---|---|
| **1 通ごとに課金されます** | メールと違い、**送るたびにお金がかかります**——**大量配信には向きません** |
| **サーバ処理から直接 import しない** | Twilio SDK を読むと **`next build` が落ちます**——動的 import を使ってください |
| **文字数で分割されます** | 日本語は**70 文字**で 1 通です。長い文章は**複数通分の料金**になります |
| **番号は国際形式で** | `+81...` です——`@platform/phone` の `normalizePhone` を通してください |
| **緊急連絡には向きません** | 遅延することがあります——**確実に届く保証はありません** |

## よく使うもの

```ts
import { createSms, buildOtpSms, withSmsRetry } from "@platform/sms";
import { createSms, createTwilioTransport } from "@platform/sms";
const sms = createSms({
  transport: createTwilioTransport({ accountSid, authToken }),
  defaultFrom: "+815012345678",
});
await sms.sendSms({ to: "+819012345678", body: "認証コード: 1234" });
```

## 認証コード SMS(OTP)
コードの生成・検証は `@platform/auth` の OTP を使い、ここは文面を組み立てます。
```ts
import { buildOtpSms } from "@platform/sms";
buildOtpSms({ to: "+819012345678", code: "123456", appName: "社内システム", expiryMinutes: 5 });
// → { to, body: "【社内システム】認証コード: 123456(5分間有効)" }
```
`template`(`{code}` / `{app}` / `{minutes}`)で文面を上書きできます。文字数・分割数は `smsInfo` で確認できます。


## ブラウザから使う入口(`@platform/sms/browser`)

バレル(`@platform/sms`)は **Twilio SDK** を読み込みます。Twilio は `fs` / `net` / `tls`
を使うため、`"use client"` から import すると **`next build` が落ちます**。

```tsx
"use client";
import { createSms, createMemoryTransport, smsInfo } from "@platform/sms/browser";
```

含むもの: 送信の組み立て・文字数計算・メモリ実装(**呼び出し方は Twilio でも同じ**)。
含まないもの: `createTwilioTransport`(サーバ専用)。
