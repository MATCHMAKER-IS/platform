import { describe, it, expect } from "vitest";
import { withDedup, createMemorySeenStore } from "./dedup";
import { withRetry, createFallbackChannel } from "./resilient";
import type { NotifyChannel } from "./index";

describe("notify resilience", () => {
  it("dedup suppresses duplicates within TTL", async () => {
    let clk = 0; const sent: string[] = [];
    const base: NotifyChannel = { send: async (m) => { sent.push(m.text); } };
    const dd = withDedup(base, { store: createMemorySeenStore(() => clk), ttlMs: 1000 });
    await dd.send({ text: "a" }); await dd.send({ text: "a" });
    expect(sent).toEqual(["a"]);
    clk = 1001; await dd.send({ text: "a" });
    expect(sent).toEqual(["a", "a"]);
  });
  it("retry then succeed / exhaust", async () => {
    let n = 0;
    const flaky: NotifyChannel = { send: async () => { n++; if (n < 3) throw new Error("5xx"); } };
    await withRetry(flaky, { retries: 2, sleep: async () => {} }).send({ text: "x" });
    expect(n).toBe(3);
    const bad: NotifyChannel = { send: async () => { throw new Error("down"); } };
    await expect(withRetry(bad, { retries: 1, sleep: async () => {} }).send({ text: "y" })).rejects.toThrow("down");
  });
  it("fallback uses secondary when primary fails", async () => {
    let s = 0;
    const primary: NotifyChannel = { send: async () => { throw new Error("p"); } };
    const secondary: NotifyChannel = { send: async () => { s++; } };
    await createFallbackChannel([primary, secondary]).send({ text: "z" });
    expect(s).toBe(1);
    await expect(createFallbackChannel([primary, { send: async () => { throw new Error("q"); } }]).send({ text: "w" })).rejects.toThrow("q");
  });
});
