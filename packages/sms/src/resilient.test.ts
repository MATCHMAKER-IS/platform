import { describe, it, expect } from "vitest";
import { withSmsRetry, createFallbackSmsTransport } from "./resilient.js";
import type { SmsTransport } from "./index.js";
const msg = { to: "+81", body: "x", from: "+81" };
describe("sms resilience", () => {
  it("retry then succeed", async () => {
    let n = 0;
    const t: SmsTransport = { send: async () => { n++; if (n < 3) throw new Error("e"); } };
    await withSmsRetry(t, { retries: 2, sleep: async () => {} }).send(msg);
    expect(n).toBe(3);
  });
  it("fallback to secondary", async () => {
    let s = 0;
    await createFallbackSmsTransport([{ send: async () => { throw new Error("p"); } }, { send: async () => { s++; } }]).send(msg);
    expect(s).toBe(1);
    await expect(createFallbackSmsTransport([{ send: async () => { throw new Error("a"); } }, { send: async () => { throw new Error("b"); } }]).send(msg)).rejects.toThrow("b");
  });
});
