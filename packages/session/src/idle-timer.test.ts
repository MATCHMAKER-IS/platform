import { describe, it, expect } from "vitest";
import { createIdleTimer, IDLE_ACTIVITY_EVENTS } from "./idle-timer.js";

function makeSched() {
  const jobs = new Map<number, { fn: () => void; at: number }>();
  let id = 0; let t = 0;
  return {
    sched: { set: (fn: () => void, ms: number) => { const h = ++id; jobs.set(h, { fn, at: t + ms }); return h; }, clear: (h: unknown) => jobs.delete(h as number) },
    advance: (ms: number) => { t += ms; for (const [h, j] of [...jobs]) if (j.at <= t) { jobs.delete(h); j.fn(); } },
  };
}
describe("idle timer", () => {
  it("warns then logs out; resets on activity", () => {
    let warned = false, idle = false, active = false;
    const m = makeSched();
    const timer = createIdleTimer({ timeoutMs: 1000, warnBeforeMs: 200, onWarn: () => (warned = true), onIdle: () => (idle = true), onActive: () => (active = true), scheduler: m.sched });
    timer.start();
    m.advance(800); expect(warned).toBe(true); expect(idle).toBe(false);
    timer.activity(); expect(active).toBe(true);
    m.advance(999); expect(idle).toBe(false);
    m.advance(1); expect(idle).toBe(true);
  });
  it("exposes activity events", () => {
    expect(IDLE_ACTIVITY_EVENTS).toContain("keydown");
    expect(IDLE_ACTIVITY_EVENTS).toContain("visibilitychange");
  });
});
