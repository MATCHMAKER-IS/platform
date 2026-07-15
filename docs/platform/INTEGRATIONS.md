# 外部サービス連携の方針

外部連携パッケージ(`@platform/line` `@platform/google` `@platform/freee` `@platform/zoho` 等)は、
すべて `@platform/integrations`(型付き HTTP クライアント)の上に薄く乗せています。

## 責務の分担
- **基盤(コネクタ)**: 主要 API を型付きで叩く。エラーは Result に統一。
  加えて **OAuth トークンの自動更新**(リフレッシュ)を提供する
  — `createZohoTokenManager` / `createGoogleTokenManager` / `createFreeeTokenManager`。
  同時更新の1本化・401 での自動リトライ・リフレッシュトークンのローテーション対応を含む。
- **アプリ**: OAuth の**初回認可フロー**(ログイン画面へ誘導→認可コード→初回トークン取得)、
  トークンの**永続化**(`onRefresh` コールバックで受け取り `@platform/crypto` で暗号化保管)、
  クライアント ID/シークレットの管理(`@platform/secrets`)、データセンター判定(Zoho)など。

**当初(ADR 0002)は認可からリフレッシュまでをすべてアプリ責務としていましたが、
リフレッシュは定型処理で各アプリが再実装するのは非効率なため、基盤に取り込みました(ADR 0005)。**
アプリは「初回認可」と「秘密情報の保管」という、アプリ固有・秘匿性の高い部分だけを担います。
`fetchImpl` 注入により、トークンマネージャ・耐障害ラッパー・実 fetch を自由に合成できます。

## 新しいコネクタの追加
1. `pnpm scaffold <service>` で雛形を作る。
2. `createApiClient({ baseUrl, headers })` でベース URL と認証ヘッダを設定。
3. 主要エンドポイントを型付きメソッドとして公開する(`fetchImpl` を注入可能にする)。
4. トークンが失効する OAuth 連携なら、トークンマネージャ(自動更新)も提供する。
5. Webhook を受ける連携なら、署名検証 + イベントパースを提供する
   (署名方式に注意: LINE は base64、freee/汎用 `@platform/webhook` は hex)。
6. `CATALOG.md` / `capabilities.json` / `typedoc.json` に追記する。

## 認証ヘッダの注意
- 多くは `Authorization: Bearer <token>`(LINE / Google / freee)。
- **Zoho は `Authorization: Zoho-oauthtoken <token>`**(Bearer ではない)。

## 決済(Stripe / PayPal)
- **Stripe** は form エンコード・Webhook 署名検証など独自要件があるため、
  唯一 `integrations` ではなく公式 `stripe` SDK をラップしています(`@platform/stripe`)。
  Webhook は必ず `verifyWebhook` で署名検証してから処理すること。
- **PayPal** は `integrations` の上に実装し、client_id/secret からアクセストークンを
  自動取得・キャッシュします(`@platform/paypal`)。live / sandbox を切替可能。
- キー・シークレットは `@platform/env` で検証し、`@platform/crypto` 等で安全に扱うこと。
