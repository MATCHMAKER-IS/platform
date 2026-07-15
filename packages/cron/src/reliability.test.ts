import { describe, it, expect } from "vitest";
import { createMemoryLockStore } from "./lock.js";
import { createGuardedJob } from "./runner.js";

describe("cron reliability", () => {
  it("distributed lock prevents concurrent runs", async () => {
    const store = createMemoryLockStore(); let runs = 0;
    const mk = () => createGuardedJob({ name: "n", lock: { store, ttlMs: 1000 }, handler: async () => { runs++; await new Promise((r) => setTimeout(r, 20)); }, sleep: async () => {} });
    await Promise.all([mk().run(), mk().run()]);
    expect(runs).toBe(1);
  });
  it("preventOverlap skips concurrent", async () => {
    const j = createGuardedJob({ name: "o", preventOverlap: true, handler: async () => { await new Promise((r) => setTimeout(r, 20)); } });
    await Promise.all([j.run(), j.run()]);
    expect(j.stats().skipped).toBe(1);
  });
  it("jitter applies bounded delay", async () => {
    let slept = -1;
    const j = createGuardedJob({ name: "j", jitterMs: 1000, handler: async () => {}, random: () => 0.5, sleep: async (ms) => { slept = ms; } });
    await j.run();
    expect(slept).toBe(500);
  });
  it("tracks success and failure stats", async () => {
    const ok = createGuardedJob({ name: "s", handler: async () => {}, sleep: async () => {} });
    await ok.run();
    expect(ok.stats().successes).toBe(1);
    const bad = createGuardedJob({ name: "f", handler: async () => { throw new Error("x"); }, sleep: async () => {} });
    await bad.run();
    expect(bad.stats().failures).toBe(1);
    expect(bad.stats().lastError).toBe("x");
  });
});
