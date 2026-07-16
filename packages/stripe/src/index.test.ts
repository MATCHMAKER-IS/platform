import { describe, it, expect, vi } from "vitest";

// 公式 SDK をモックし、ラッパーの Result 化と署名検証エラーを検証する。
const constructEvent = vi.fn();
const create = vi.fn().mockResolvedValue({ id: "pi_1" });
vi.mock("stripe", () => ({
  default: class {
    paymentIntents = { create };
    checkout = { sessions: { create } };
    refunds = { create };
    webhooks = { constructEvent };
  },
}));

import { createStripeClient } from "./index";

describe("stripe", () => {
  it("createPaymentIntent は Result を返す", async () => {
    const stripe = createStripeClient({ secretKey: "sk_test" });
    const res = await stripe.createPaymentIntent({ amount: 1000, currency: "jpy" });
    expect(res.ok && res.value.id).toBe("pi_1");
  });

  it("verifyWebhook は署名不正時に UNAUTHORIZED", () => {
    constructEvent.mockImplementationOnce(() => { throw new Error("bad sig"); });
    const stripe = createStripeClient({ secretKey: "sk_test" });
    const res = stripe.verifyWebhook("body", "sig", "whsec");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("UNAUTHORIZED");
  });

  it("verifyWebhook は正当な署名でイベントを返す", () => {
    constructEvent.mockReturnValueOnce({ id: "evt_1", type: "payment_intent.succeeded" });
    const stripe = createStripeClient({ secretKey: "sk_test" });
    const res = stripe.verifyWebhook("body", "sig", "whsec");
    expect(res.ok && res.value.id).toBe("evt_1");
  });
});
