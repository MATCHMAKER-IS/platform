import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { verifyLineSignature, parseLineWebhook, parsePostbackData, eventSourceId } from "./webhook.js";
const secret = "s";
const sign = (b: string) => createHmac("sha256", secret).update(b).digest("base64");
describe("line webhook", () => {
  it("verifies base64 signature", () => {
    const body = '{"events":[]}';
    expect(verifyLineSignature(body, sign(body), secret)).toBe(true);
    expect(verifyLineSignature(body + "x", sign(body), secret)).toBe(false);
  });
  it("parses events and postback data", () => {
    const body = JSON.stringify({ events: [{ type: "postback", timestamp: 1, source: { type: "user", userId: "U1" }, postback: { data: "action=approve&id=1" } }] });
    const events = parseLineWebhook(body);
    expect(events[0]!.type).toBe("postback");
    expect(parsePostbackData("action=approve&id=1")).toEqual({ action: "approve", id: "1" });
    expect(eventSourceId({ type: "user", userId: "U1" })).toBe("U1");
  });
});
