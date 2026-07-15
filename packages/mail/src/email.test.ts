import { describe, it, expect } from "vitest";
import { isValidEmail, normalizeEmail, emailDomain, isSameDomain, parseAddress, formatAddress, parseEmailList, dedupeEmails } from "./email.js";

describe("email utils", () => {
  it("validation", () => { expect(isValidEmail("a.b+t@ex.co.jp")).toBe(true); expect(isValidEmail("bad@")).toBe(false); });
  it("normalize", () => { expect(normalizeEmail(" A@X.COM ")).toBe("a@x.com"); expect(normalizeEmail("j.d+n@googlemail.com", { gmail: true })).toBe("jd@gmail.com"); });
  it("domain", () => { expect(emailDomain("a@x.jp")).toBe("x.jp"); expect(isSameDomain("a@x.jp", "b@X.JP")).toBe(true); });
  it("parse/format", () => { expect(parseAddress("山田 <y@x.jp>")).toEqual({ name: "山田", email: "y@x.jp" }); expect(formatAddress({ name: "Yamada, T", email: "y@x.jp" })).toBe('"Yamada, T" <y@x.jp>'); });
  it("list/dedupe", () => { expect(parseEmailList("a@x.jp, bad; b@y.jp")).toEqual(["a@x.jp", "b@y.jp"]); expect(dedupeEmails(["A@x.jp", "a@x.jp"])).toEqual(["A@x.jp"]); });
});
