import { describe, it, expect } from "vitest";
import { createLifecycle } from "./lifecycle";
describe("lifecycle", () => {
  it("runs hooks in reverse, survives failures, dedupes", async () => {
    const order: string[] = [];
    const lc = createLifecycle({ exitProcess: false, onSignal: () => {}, hookTimeoutMs: 1000 });
    lc.onShutdown("a", () => { order.push("a"); });
    lc.onShutdown("bad", () => { throw new Error("x"); });
    lc.onShutdown("c", () => { order.push("c"); });
    await lc.shutdown("test");
    expect(order).toEqual(["c", "a"]);
    expect(lc.isShuttingDown()).toBe(true);
    await lc.shutdown("again"); // dedupe
    expect(order).toEqual(["c", "a"]);
  });
});
