# @platform/ekyc

eKYC(オンライン本人確認)ベンダー連携コネクタ。TRUSTDOCK 等の API を型付きで扱い、
判定結果の Webhook 署名検証・パース・ステータス正規化を提供します。
他の SaaS コネクタと同じく `@platform/integrations` の上に薄く乗せ、`fetchImpl` 注入でテスト可能です。

## 役割分担
- **基盤(このパッケージ)**: 申込の作成・状態取得・画像URL取得を型付きで呼ぶ / Webみ署名検証・結果の正規化。
- **アプリ**: OAuth・APIキーの保管(`@platform/secrets`)、Webhook 受信の配線、
  **画像の実ダウンロード**(TRUSTDOCK は mTLS クライアント証明書が必要・取得期限あり)、判定後の業務処理。

一般的な流れ: 申込作成 → 利用者が書類/顔画像を提出 → ベンダーが審査 → **判定を Webhook で通知** → 画像URLを取得して保存。

## クライアント
```ts
import { createTrustdockClient } from "@platform/ekyc";

const kyc = createTrustdockClient({ apiKey: secrets.TRUSTDOCK_API_KEY, environment: "production" });
const created = await kyc.createApplication({ /* 申込項目(ベンダー仕様) */ });
const app = await kyc.getApplication(applicationId); // 状態・判定の取得
const images = await kyc.getImageUrls(applicationId); // 画像URL(DLはアプリ側で mTLS)
```
汎用の `createEkycClient({ apiKey, baseUrl, authHeader, apiKeyPrefix, endpoints, fetchImpl })` で
他ベンダー(Bearer 認証・独自パス)にも対応できます。

> ⚠️ **エンドポイント・項目名・ベースURLはベンダーの API リファレンスで確認してください。**
> TRUSTDOCK は NDA 締結後に API ドキュメントが提供されます。既定値は一般的な REST 形状の雛形です。
> `endpoints` オプションで実際のパスに合わせられます。

## Webhook(判定通知)
```ts
import { verifyEkycSignature, parseEkycWebhook } from "@platform/ekyc";

// 署名検証(hex / base64 はベンダー仕様に合わせる)
if (!verifyEkycSignature(rawBody, req.headers["x-signature"], secret)) return unauthorized();
const event = parseEkycWebhook(rawBody); // { applicationId, status, rawStatus, reason, raw }
if (event.status === "approved") { /* 本人確認 OK の業務処理 */ }
```
`@platform/webhook`(冪等・分配)と組み合わせると、重複配送や再試行にも安全に対応できます。

## ステータス正規化
ベンダーで文言が違うため、共通の `EkycStatus`(created/submitted/in_review/approved/rejected/expired/canceled/unknown)に寄せます。
```ts
import { normalizeEkycStatus, isEkycApproved, isEkycFinal } from "@platform/ekyc";
normalizeEkycStatus("NG");        // "rejected"
normalizeEkycStatus("完了", { "完了": "approved" }); // カスタム語彙
```

## マイナンバー・本人確認書類の取扱い
書類番号の書式検証は `@platform/validation`(`validateIdentityDocument` 等)、
マスキング・暗号保管は `@platform/pii`(`maskMyNumber` / `createFieldCipher` / `blindIndex`)を併用してください。
