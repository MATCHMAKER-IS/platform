# @platform/sms

SMS 送信の共通部品(Adapter パターン)。`mail` と同じ構造です。

- `createTwilioTransport` … Twilio 経由
- `createMemoryTransport` … テスト・デバッグ用(送信内容を配列に記録)

```ts
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

