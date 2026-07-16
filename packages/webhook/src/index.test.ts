import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { verifyHmacSignature, createWebhookReceiver } from "./index";
const secret = "whsec";
const sign = (p: string, pre = "") => pre + createHmac("sha256", secret).update(p).digest("hex");
describe("webhook", () => {
  it("verifies HMAC signatures", () => {
    const body = '{"id":"1"}';
    expect(verifyHmacSignature({ payload: body, signature: sign(body), secret })).toBe(true);
    expect(verifyHmacSignature({ payload: body + "x", signature: sign(body), secret })).toBe(false);
  });
  it("verifies signature, dedupes, dispatches", async () => {
    const seen: number[] = [];
    const r = createWebhookReceiver<{ id: string; type: string; amount: number }>({
      secret, signaturePrefix: "sha256=", parse: JSON.parse, eventId: (e) => e.id, eventType: (e) => e.type,
    });
    r.on("paid", async (e) => { seen.push(e.amount); });
    const body = '{"id":"e1","type":"paid","amount":100}';
    expect((await r.handle(body, sign(body, "sha256="))).status).toBe("processed");
    expect((await r.handle(body, sign(body, "sha256="))).status).toBe("duplicate");
    expect((await r.handle(body, "sha256=bad")).status).toBe("invalid_signature");
    expect(seen).toEqual([100]);
  });
});
