import { describe, it, expect } from "vitest";
import { createUnsubscribeToken, verifyUnsubscribeToken, unsubscribeUrl, listUnsubscribeHeaders, removeSuppressed, isSuppressed } from "./unsubscribe";
const secret = "s3cret";
describe("mail unsubscribe", () => {
  it("signs and verifies tokens", () => {
    const t = createUnsubscribeToken("User@Example.com", secret, { category: "news" });
    const v = verifyUnsubscribeToken(t, secret);
    expect(v.valid).toBe(true);
    expect(v.email).toBe("user@example.com");
    expect(v.category).toBe("news");
    expect(verifyUnsubscribeToken(t + "x", secret).valid).toBe(false);
    expect(verifyUnsubscribeToken(t, "wrong").valid).toBe(false);
  });
  it("builds url and headers, filters suppressed", () => {
    expect(unsubscribeUrl("https://x.com/u", "a@b.com", secret)).toContain("?token=");
    const h = listUnsubscribeHeaders({ url: "https://x.com/u?t=1", mailto: "u@x.com", oneClick: true });
    expect(h["List-Unsubscribe"]).toBe("<https://x.com/u?t=1>, <mailto:u@x.com>");
    expect(h["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    expect(isSuppressed("STOP@x.com", new Set(["stop@x.com"]))).toBe(true);
    expect(removeSuppressed(["a@x.com", "stop@x.com"], new Set(["stop@x.com"])).sendable).toEqual(["a@x.com"]);
  });
});
