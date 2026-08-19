import { describe, it, expect } from "vitest";
import { signSession, verifySession, type SessionPayload } from "./zoho-session";

describe("zoho session", () => {
  it("sign/verify round-trip + tamper", () => {
    // **`roles` は必須**(RBAC の付与ロール)。欠けたまま通っていたのは
    // 型検査が回っていなかったため——**認可の判断材料が入らないセッション**を
    // 相手に検証していたことになる(2026-08、型検査で判明)。
    const secret = "s";
    const p: SessionPayload = { email: "a@x.jp", roles: ["user"], exp: Math.floor(Date.now() / 1000) + 3600 };
    const t = signSession(p, secret);
    expect(verifySession(t, secret)!.email).toBe("a@x.jp");
    expect(verifySession(t, "wrong")).toBeNull();
    expect(verifySession(t.slice(0, -2) + "xx", secret)).toBeNull();
    expect(verifySession(signSession({ email: "a@x.jp", roles: ["user"], exp: 1 }, secret), secret)).toBeNull();
  });
});
