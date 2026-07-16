import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { verifyEkycSignature, parseEkycWebhook } from "./webhook";
describe("ekyc webhook", () => {
  const secret = "whsec";
  const body = JSON.stringify({ application_id: "app_9", status: "approved" });
  it("verifies hmac (hex/base64)", () => {
    const hex = createHmac("sha256", secret).update(body).digest("hex");
    expect(verifyEkycSignature(body, hex, secret)).toBe(true);
    expect(verifyEkycSignature(body + "x", hex, secret)).toBe(false);
    const b64 = createHmac("sha256", secret).update(body).digest("base64");
    expect(verifyEkycSignature(body, b64, secret, "base64")).toBe(true);
  });
  it("parses and normalizes", () => {
    const e = parseEkycWebhook(JSON.stringify({ verification_id: "v1", result: "NG", detail: "不鮮明" }));
    expect(e.applicationId).toBe("v1");
    expect(e.status).toBe("rejected");
    expect(e.reason).toBe("不鮮明");
  });
});
