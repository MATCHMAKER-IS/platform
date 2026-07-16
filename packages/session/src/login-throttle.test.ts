import { describe, it, expect } from "vitest";
import { createLoginThrottle, createMemoryThrottleStore } from "./login-throttle";
describe("login throttle", () => {
  it("locks after max fails and clears on success", async () => {
    let clock = 0; const now = () => clock;
    const th = createLoginThrottle({ maxFails: 3, lockMs: 30000, store: createMemoryThrottleStore(now), now });
    expect((await th.check("a")).allowed).toBe(true);
    await th.recordFailure("a"); await th.recordFailure("a");
    const c = await th.recordFailure("a");
    expect(c.allowed).toBe(false);
    expect((await th.check("a")).allowed).toBe(false);
    clock += 30001;
    expect((await th.check("a")).allowed).toBe(true);
    await th.recordSuccess("a");
    expect((await th.check("a")).remaining).toBe(3);
  });
  it("progressive backoff doubles lock", async () => {
    let clock = 0; const now = () => clock;
    const th = createLoginThrottle({ maxFails: 1, lockMs: 1000, progressive: true, store: createMemoryThrottleStore(now), now });
    const f1 = await th.recordFailure("k"); clock += 1001;
    const f2 = await th.recordFailure("k");
    expect(f1.retryAfterMs).toBe(1000);
    expect(f2.retryAfterMs).toBe(2000);
  });
});
