/**
 * `@platform/stripe` — Stripe 決済クライアント(公式 SDK ラッパー)。
 *
 * Stripe は form エンコードや Webhook 署名検証など独自要件があるため、
 * 自前 HTTP ではなく公式 `stripe` SDK をラップする。よく使う操作
 * (PaymentIntent・Checkout Session・返金・Webhook 検証)を Result で返す。
 * シークレットキーの管理はアプリ側の責務。
 *
 * @packageDocumentation
 */

import Stripe from "stripe";
import { AppError, ErrorCode, tryCatch, type Result } from "@platform/core";

/** Stripe クライアント。 */
export interface StripeClient {
  /** 決済意図(PaymentIntent)を作成する。 */
  createPaymentIntent(params: Stripe.PaymentIntentCreateParams): Promise<Result<Stripe.PaymentIntent>>;
  /** Checkout セッションを作成する(ホスト型決済ページ)。 */
  createCheckoutSession(params: Stripe.Checkout.SessionCreateParams): Promise<Result<Stripe.Checkout.Session>>;
  /** 返金する。 */
  refund(params: Stripe.RefundCreateParams): Promise<Result<Stripe.Refund>>;
  /**
   * Webhook の署名を検証し、イベントを返す。改ざん・不正リクエストを弾く。
   * @param payload 生のリクエストボディ(パース前の文字列/Buffer)
   * @param signature `Stripe-Signature` ヘッダの値
   * @param webhookSecret Webhook エンドポイントのシークレット
   */
  verifyWebhook(payload: string | Buffer, signature: string, webhookSecret: string): Result<Stripe.Event>;
  /** 生の Stripe SDK インスタンス(上記に無い操作が必要なとき)。 */
  readonly raw: Stripe;
}

/**
 * Stripe クライアントを作る。
 * @param config `secretKey` … Stripe シークレットキー(sk_...)
 * @returns {@link StripeClient}
 *
 * @example
 * ```ts
 * const stripe = createStripeClient({ secretKey: env.STRIPE_SECRET_KEY });
 * const res = await stripe.createPaymentIntent({ amount: 1000, currency: "jpy" });
 * ```
 */
/**
 * 固定する Stripe API バージョン。
 *
 * **ここを書き換えるのは、変更履歴を読んでテストを通してから。**
 * 未指定だとアカウントの既定が使われ、管理画面の操作で挙動が変わる。
 */
export const STRIPE_API_VERSION = "2024-06-20";

/**
 * Stripe を扱う器を作る（**公式 SDK の薄い包み**）。
 *
 * **`fetch` を差し替えられません**——SDK が内部で通信するためです。
 * そのため**契約テストが効かず**、確認は**sandbox キーでの実接続**に頼ります
 * （基盤の `UNUSED_REASONS` に理由を書いてあります）。
 *
 * **秘密鍵はサーバ側だけで使ってください。** 画面に渡すのは公開鍵です
 * ——秘密鍵が漏れると、**誰でも返金や請求ができます**。
 *
 * @param config `secretKey`（**サーバ側のみ**）と `apiVersion`
 * @returns Stripe を呼ぶ器
 */
export function createStripeClient(config: { secretKey: string; apiVersion?: string }): StripeClient {
  // **API バージョンを固定する。** 指定しないと**アカウントの既定**が使われ、
  // Stripe は日付でバージョンを切り、**ダッシュボードから変更できる**。
  // 誰かが管理画面で上げると、こちらがデプロイしていないのに応答の形が変わり、
  // **決済が突然失敗するのに原因が分からない**(コードは何も変えていない)。
  //
  // 上げるときは変更履歴を読み、テストを通してからこの値を書き換えること。
  const stripe = new Stripe(config.secretKey, {
    apiVersion: (config.apiVersion ?? STRIPE_API_VERSION) as Stripe.LatestApiVersion,
  });
  return {
    raw: stripe,
    createPaymentIntent: (params) => tryCatch(() => stripe.paymentIntents.create(params)),
    createCheckoutSession: (params) => tryCatch(() => stripe.checkout.sessions.create(params)),
    refund: (params) => tryCatch(() => stripe.refunds.create(params)),
    verifyWebhook(payload, signature, webhookSecret) {
      try {
        return { ok: true, value: stripe.webhooks.constructEvent(payload, signature, webhookSecret) };
      } catch (e) {
        return {
          ok: false,
          error: new AppError(ErrorCode.UNAUTHORIZED, "Stripe Webhook の署名検証に失敗しました", { cause: e }),
        };
      }
    },
  };
}

export type { Stripe };
