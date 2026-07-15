import { describe, it, expect } from "vitest";
import { signSession, verifySession } from "./zoho-session.js";

describe("zoho session", () => {
  it("sign/verify round-trip + tamper", () => {
    const secret = "s"; const p = { email: "a@x.jp", exp: Math.floor(Date.now() / 1000) + 3600 };
    const t = signSession(p, secret);
    expect(verifySession(t, secret)!.email).toBe("a@x.jp");
    expect(verifySession(t, "wrong")).toBeNull();
    expect(verifySession(t.slice(0, -2) + "xx", secret)).toBeNull();
    expect(verifySession(signSession({ email: "a@x.jp", exp: 1 }, secret), secret)).toBeNull();
  });
});
