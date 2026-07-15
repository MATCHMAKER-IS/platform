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
export function createStripeClient(config: { secretKey: string }): StripeClient {
  const stripe = new Stripe(config.secretKey);
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
