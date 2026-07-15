# @platform/auth

認証・認可の共通部品。

- **RBAC**: `definePolicy` / `can` / `assertCan` / `permissionsOf`(純ロジック、再利用可)
- **セッション型**: `AuthUser` / `Session`
- **OIDC 設定の標準化**: `OidcProviderConfig` / `resolveIssuer`(Entra / Google / generic)

```ts
import { definePolicy, assertCan } from "@platform/auth";

export const policy = definePolicy({
  admin: ["*"],
  sales: ["invoice:read", "invoice:create"],
});

assertCan(policy, session.user, "invoice:create"); // 権限が無ければ FORBIDDEN を throw
```

## SSO の実装分担

実際の SSO フロー(リダイレクト・コールバック・セッション発行)は **アプリ側**で
Auth.js(NextAuth)や better-auth を使って実装します。このパッケージは
「認証済みユーザーの表現」と「権限判定」「IdP 設定の標準化」に責務を絞っています
(フレームワークに強く結合する部分を基盤に持ち込まないため)。

## ワンタイムパスワード(OTP / SMS認証)
SMS やメールで送る数字コードによる認証フロー。コードは平文で保存せず HMAC ハッシュで保持し、
検証は定数時間比較、試行回数・有効期限・再送クールダウンを扱います(チャネル非依存)。
```ts
import { createOtpChallenge, verifyOtpCode, canResendOtp } from "@platform/auth";
import { buildOtpSms } from "@platform/sms";

// 発行: code を SMS 送信、challenge を保存(コードは challenge に平文で入らない)
const { challenge, code } = createOtpChallenge(phone, OTP_SECRET, { length: 6, ttlSec: 300, maxAttempts: 5 });
await sms.send(buildOtpSms({ to: phone, code, appName: "社内システム", expiryMinutes: 5 }));
await store.save(challenge.id, challenge);

// 検証: 期限切れ・試行超過・不一致を区別
const result = verifyOtpCode(await store.get(id), input, OTP_SECRET);
if (result.status === "ok") grantAccess();          // 成功後は challenge を破棄(再利用不可)
else await store.save(id, result.challenge);         // 試行回数を更新して保存
```
再送は `canResendOtp(challenge, cooldownSec)` / `resendWaitSeconds` で制御。すべて純ロジックで、
`OtpChallenge` はそのまま DB / キャッシュ(`@platform/cache`)に保存できます。試行制限は `@platform/ratelimit` と併用も可。

## TOTP(認証アプリ / Google Authenticator 対応)
時間ベースのワンタイムパスワード(RFC 6238)。認証アプリと互換で、RFC の公式テストベクタで検証済みです。
```ts
import { generateTotpSecret, totpAuthUri, verifyTotp } from "@platform/auth";

// 登録: シークレット生成 → otpauth URI を QR 化して認証アプリで読み取り
const secret = generateTotpSecret();
const uri = totpAuthUri(secret, { issuer: "社内システム", account: "user@example.com" });
// QR コード化(uri を @platform/ui の QR 等で表示)、secret はユーザーに紐づけて保存

// 検証: 認証アプリが表示する6桁コードを確認(時刻ずれ ±30秒許容)
if (verifyTotp(secret, inputCode, { window: 1 })) grantAccess();
```
`base32Encode` / `base32Decode`、`hotp`(RFC 4226)、`totp`、`totpAuthUri` を提供。SMS OTP(otp.ts)が
「サーバーが送る使い捨てコード」なのに対し、TOTP は「アプリが時刻から生成するコード」で、2要素認証の主力に使えます。

## バックアップコード(リカバリーコード)
認証アプリや電話を失ったときの代替ログイン手段。**平文保存せず HMAC ハッシュで保持**、各コードは**一度だけ使用可**。
```ts
import { generateBackupCodes, verifyBackupCode, remainingBackupCodes } from "@platform/auth";

// 2FA 有効化時: 生成して codes を一度だけ表示、records を保存
const { codes, records } = generateBackupCodes(BACKUP_SECRET);  // codes: ["abcd-efgh", ...]
showOnce(codes); await store.save(userId, records);

// ログイン時(コード入力): 一致すれば使用済みに(区切り・大小は自動正規化)
const result = verifyBackupCode(input, await store.get(userId), BACKUP_SECRET);
if (result.valid) { await store.save(userId, result.records); grantAccess(); }

// 残数が少なければ再生成を促す
if (remainingBackupCodes(records) <= 2) promptRegenerate();
```
コードは紛らわしい文字(0/O・1/l 等)を除いた読みやすい英数字。TOTP/SMS OTP と組み合わせて 2FA の保険にします。すべて純ロジック。

## 2 段階認証(2FA)の統合フロー
TOTP・SMS OTP・バックアップコードを 1 つの窓口で扱います。ユーザーの登録状態から検証を振り分けます。
```ts
import { verifyTwoFactor, verifyAnyTwoFactor, availableMethods } from "@platform/auth";

const config = { totpSecret, smsPhone, backupCodes };   // ユーザーの2FA登録状態(保存)
availableMethods(config);  // ["totp", "sms", "backup"]

// 手段を指定して検証(backup は自動で使用済みに、sms はチャレンジに対して検証)
const r = verifyTwoFactor(config, "totp", inputCode, { secret });
if (r.verified) { await store.save(userId, r.config); grantAccess(); }

// 手段が不明なとき(TOTP→バックアップの順で自動判定)
const any = verifyAnyTwoFactor(config, inputCode, { secret });
```

## パスキー / WebAuthn
パスキー(FIDO2 / WebAuthn)のサーバー側部品。チャレンジ生成・オプション組み立て・検証の要を提供します。
```ts
import { webAuthnRegistrationOptions, verifyClientData, parseAuthenticatorData, verifyRpIdHash, verifyAssertionSignature, isSignCountValid } from "@platform/auth";

// 登録: オプションを組み立てて challenge を保存 → ブラウザ navigator.credentials.create()
const opts = webAuthnRegistrationOptions({ rpId: "example.com", rpName: "社内システム", userId, userName });

// 認証検証: clientData(challenge/origin/type)→ rpIdHash → 署名 → signCount
if (!verifyClientData(clientDataJSON, { challenge, origin: "https://example.com", type: "webauthn.get" }).valid) reject();
if (!verifyRpIdHash(authData, "example.com")) reject();
if (!verifyAssertionSignature({ publicKeyPem, authenticatorData: authData, clientDataJSONBase64Url: clientDataJSON, signatureBase64Url: signature })) reject();
if (!isSignCountValid(storedCount, parseAuthenticatorData(authData).signCount)) flagCloneWarning();
```
署名検証は EC P-256(ES256)で実検証済み。**アテステーション証明書の検証や COSE 公開鍵の抽出(登録時)は CBOR 解析が必要**なため、実運用では検証済みライブラリの併用を推奨します。基盤は依存ゼロで正しく提供できる範囲(チャレンジ/オプション/clientData/authData/署名検証)を担います。

