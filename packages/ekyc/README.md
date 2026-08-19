# @platform/ekyc

本人確認（eKYC）。**外部サービスを差し替えられる**形にしてあります。

## これは何のためか

**「本当にその人か」を確かめる**ためのものです。

口座の開設や、高額の取引で求められます。
**自前で作るものではありません**——外部のサービスを使います。

## 使う前に知っておくこと

| | |
|---|---|
| **サービスごとに状態名が違います** | `approved` / `verified` / `completed`——**共通の形に直して**扱います |
| **確定していないものは待つ** | 「審査中」を**成功として扱わないで**ください——後で否認されます |
| **本人確認書類は個人情報の塊です** | 免許証の画像には**住所・生年月日・顔写真**が入ります。**保存期間を必ず決めて**ください |
| **結果だけ持ち、書類は持たない** | 可能なら、**画像は外部サービスに置いたまま**にしてください——**漏れたときの被害が違います** |

## よく使うもの

```ts
import { createEkycClient, createTrustdockClient, normalizeEkycStatus } from "@platform/ekyc";
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
