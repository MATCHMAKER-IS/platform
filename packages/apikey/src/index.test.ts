import { describe, it, expect } from "vitest";
import { generateApiKey, verifyApiKey, hasScope, hasAllScopes, authenticateApiKey } from "./index";
describe("apikey", () => {
  it("generates and verifies", () => {
    const k = generateApiKey({ prefix: "sk_" });
    expect(k.plaintext.startsWith("sk_")).toBe(true);
    expect(verifyApiKey(k.plaintext, k.hash)).toBe(true);
    expect(verifyApiKey("sk_wrong", k.hash)).toBe(false);
  });
  it("checks scopes with wildcards", () => {
    expect(hasScope(["orders:*"], "orders:write")).toBe(true);
    expect(hasScope(["*"], "x:y")).toBe(true);
    expect(hasScope(["orders:read"], "users:read")).toBe(false);
    expect(hasAllScopes(["orders:read"], ["orders:read", "users:read"])).toBe(false);
  });
  it("authenticates, rejects revoked and expired", async () => {
    const k = generateApiKey();
    const store = { findByHash: (h: string) => h === k.hash ? { id: "1", hash: h, scopes: ["*"] } : null };
    expect((await authenticateApiKey(k.plaintext, store)).ok).toBe(true);
    expect((await authenticateApiKey("nope", store)).ok).toBe(false);
    const exp = { findByHash: () => ({ id: "2", hash: "x", scopes: [], expiresAt: 1000 }) };
    expect((await authenticateApiKey("k", exp, 2000)).ok).toBe(false);
  });
});
