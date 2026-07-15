import { describe, it, expect } from "vitest";
import { relayOutbox, createMemoryOutboxStore } from "./outbox.js";
describe("outbox", () => {
  it("dispatches, retries with backoff, exhausts", async () => {
    let clk = 0; const store = createMemoryOutboxStore(() => clk);
    store.add("t", { n: 1 });
    let r = await relayOutbox(store, async () => { throw new Error("e"); }, { now: () => clk, maxAttempts: 2, backoffMs: (n) => 100 * n });
    expect(r.failed).toBe(1); expect(store.all()[0]!.status).toBe("pending");
    clk = 100;
    r = await relayOutbox(store, async () => { throw new Error("e"); }, { now: () => clk, maxAttempts: 2, backoffMs: (n) => 100 * n });
    expect(r.exhausted).toBe(1); expect(store.all()[0]!.status).toBe("failed");
  });
  it("marks sent on success", async () => {
    const store = createMemoryOutboxStore(); store.add("t", {});
    const r = await relayOutbox(store, async () => {});
    expect(r.sent).toBe(1); expect(store.all()[0]!.status).toBe("sent");
  });
});
