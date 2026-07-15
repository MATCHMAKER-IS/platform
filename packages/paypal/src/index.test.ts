import { describe, it, expect, vi, afterEach } from "vitest";
import { createPayPalClient } from "./index.js";

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; vi.restoreAllMocks(); });

function jsonRes(body: unknown, ok = true, status = 200) {
  return { ok, status, headers: { get: () => "application/json" }, json: async () => body, text: async () => JSON.stringify(body) };
}

describe("paypal", () => {
  it("createOrder はトークンを取得してから Orders API を叩く", async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(jsonRes({ access_token: "AT", expires_in: 3600 })) // token
      .mockResolvedValueOnce(jsonRes({ id: "ORDER1", status: "CREATED" }));      // create order
    globalThis.fetch = f as unknown as typeof fetch;

    const paypal = createPayPalClient({ clientId: "id", clientSecret: "sec", environment: "sandbox" });
    const res = await paypal.createOrder({ intent: "CAPTURE", purchase_units: [] });
    expect(res.ok && res.value.id).toBe("ORDER1");

    const tokenCall = f.mock.calls[0]!;
    expect(String(tokenCall[0])).toContain("/v1/oauth2/token");
    const orderCall = f.mock.calls[1]!;
    expect(String(orderCall[0])).toContain("/v2/checkout/orders");
    expect((orderCall[1] as RequestInit).headers).toMatchObject({ Authorization: "Bearer AT" });
  });

  it("トークンはキャッシュされ2回目は再取得しない", async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(jsonRes({ access_token: "AT", expires_in: 3600 }))
      .mockResolvedValue(jsonRes({ id: "O", status: "CREATED" }));
    globalThis.fetch = f as unknown as typeof fetch;
    const paypal = createPayPalClient({ clientId: "id", clientSecret: "sec" });
    await paypal.createOrder({});
    await paypal.getOrder("O");
    const tokenCalls = f.mock.calls.filter((c) => String(c[0]).includes("/v1/oauth2/token"));
    expect(tokenCalls).toHaveLength(1);
  });
});
