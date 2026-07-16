import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { verifyFreeeSignature, parseFreeeWebhook } from "./webhook";
const secret = "s";
const sign = (b: string) => createHmac("sha256", secret).update(b).digest("hex");
describe("freee webhook", () => {
  it("verifies hex signature and parses events", () => {
    const body = JSON.stringify({ application_notifications: [{ type: "deal.created", company_id: 1 }] });
    expect(verifyFreeeSignature(body, sign(body), secret)).toBe(true);
    expect(verifyFreeeSignature(body + "x", sign(body), secret)).toBe(false);
    expect(parseFreeeWebhook(body)[0]!.type).toBe("deal.created");
    expect(parseFreeeWebhook("{}")).toHaveLength(0);
  });
});
