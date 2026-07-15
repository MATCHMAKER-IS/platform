import { describe, it, expect } from "vitest";
import { maskEmail, maskPhone, blindIndex, createFieldCipher, anonymizeRecord, isRetentionExpired } from "./index.js";
describe("pii", () => {
  it("masks", () => {
    expect(maskEmail("taro@example.co.jp")).toBe("t***@example.co.jp");
    expect(maskPhone("090-1234-5678")).toBe("*******5678");
  });
  it("blind index normalizes and is deterministic", () => {
    expect(blindIndex("A@B.jp ", "k")).toBe(blindIndex("a@b.jp", "k"));
    expect(blindIndex("x", "k1")).not.toBe(blindIndex("x", "k2"));
  });
  it("field cipher round-trips and passes null", () => {
    const store = new Map<string, string>(); let n = 0;
    const c = createFieldCipher({ encrypt: (p) => { const t = `e${++n}`; store.set(t, p); return t; }, decrypt: (t) => store.get(t)! });
    const e = c.encryptField("secret");
    expect(c.decryptField(e)).toBe("secret");
    expect(c.encryptField(null)).toBeNull();
  });
  it("anonymizes and checks retention", () => {
    const a = anonymizeRecord({ id: "1", name: "山田", total: 5 }, ["name"]);
    expect(a.name).toBe("[削除済み]"); expect(a.total).toBe(5);
    expect(isRetentionExpired(0, 30, 40 * 86400000)).toBe(true);
  });
});
