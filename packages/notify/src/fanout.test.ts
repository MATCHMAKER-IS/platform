import { describe, it, expect } from "vitest";
import { createMailChannel } from "./channels/mail";
import { notifyAllSettled, summarizeResults } from "./fanout";

describe("notify fanout", () => {
  it("per-channel results + summary", async () => {
    const ch = createMailChannel({ sendMail: async () => ({ ok: true }) }, { to: "a@x.jp", subject: "s" });
    const fail = { send: async () => { throw new Error("NG"); } };
    const results = await notifyAllSettled([{ name: "mail", channel: ch }, { name: "broken", channel: fail }], { text: "x" });
    expect(results.find((r) => r.name === "broken")).toMatchObject({ ok: false, error: "NG" });
    const sum = summarizeResults(results);
    expect(sum).toEqual({ total: 2, succeeded: 1, failed: 1, allOk: false });
  });
});
