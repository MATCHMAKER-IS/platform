import { describe, it, expect } from "vitest";
import { isAllowedRecipient, filterRecipients, applyRecipientPolicy, withRecipientPolicy } from "./allowlist";
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

describe("bcc も誤送信防止の対象にする", () => {
  const policy = { allowedDomains: ["example.co.jp"] };

  // **`to` だけを見ていると、開発環境から本番の宛先へ一斉配信が飛ぶ。**
  // 誤送信防止が一番効いてほしい場面(一斉配信)で素通りしていた(2026-08)
  it("bcc の宛先も絞り込む", () => {
    const r = applyRecipientPolicy(
      { to: "me@example.co.jp", bcc: ["a@example.co.jp", "b@other.com"], subject: "s", text: "t" },
      policy,
    );
    expect(r.message?.bcc).toEqual(["a@example.co.jp"]);
    expect(r.blocked).toContain("b@other.com");
  });
  // **付け替えるときは bcc を消す**(残すと本番の宛先へ届く)
  it("redirectTo では bcc を消す", () => {
    const r = applyRecipientPolicy(
      { to: "x@other.com", bcc: ["a@other.com"], subject: "s", text: "t" },
      { ...policy, redirectTo: "dev@example.co.jp" },
    );
    expect(r.message?.bcc).toBeUndefined();
  });
  // **to が全滅でも bcc が残れば送る**(一斉配信は bcc が本体)
  it("to が弾かれても bcc があれば送る", () => {
    const r = applyRecipientPolicy(
      { to: "x@other.com", bcc: ["a@example.co.jp"], subject: "s", text: "t" },
      policy,
    );
    expect(r.message).not.toBeNull();
  });
});
