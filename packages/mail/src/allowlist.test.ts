import { describe, it, expect } from "vitest";
import { isAllowedRecipient, filterRecipients, applyRecipientPolicy, withRecipientPolicy } from "./allowlist.js";
describe("recipient allowlist", () => {
  it("allows/blocks by domain and email with block priority", () => {
    expect(isAllowedRecipient("a@corp.com", { allowedDomains: ["corp.com"] })).toBe(true);
    expect(isAllowedRecipient("a@gmail.com", { allowedDomains: ["corp.com"] })).toBe(false);
    expect(isAllowedRecipient("x@corp.com", { allowedDomains: ["corp.com"], blockedEmails: ["x@corp.com"] })).toBe(false);
    expect(isAllowedRecipient("any@any.com", {})).toBe(true);
  });
  it("filters and applies policy, dropping when none allowed", () => {
    expect(filterRecipients(["ok@corp.com", "bad@x.com"], { allowedDomains: ["corp.com"] }).allowed).toEqual(["ok@corp.com"]);
    expect(applyRecipientPolicy({ to: "bad@x.com", subject: "s" }, { allowedDomains: ["corp.com"] }).message).toBeNull();
    expect(applyRecipientPolicy({ to: "a@b.com", subject: "s" }, {}, { redirectTo: "stg@t.com" }).message!.to).toBe("stg@t.com");
  });
  it("wrapper skips when all blocked", async () => {
    const sent: unknown[] = [];
    const guarded = withRecipientPolicy({ send: async (m: unknown) => { sent.push(m); return { ok: true }; } }, { allowedDomains: ["corp.com"] });
    const res = await guarded.send({ to: "bad@x.com", subject: "s" }) as { value: { skipped: boolean } };
    expect(sent).toHaveLength(0);
    expect(res.value.skipped).toBe(true);
  });
});
