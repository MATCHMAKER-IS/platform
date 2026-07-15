import { describe, it, expect } from "vitest";
import { createContextStore } from "./context.js";

describe("log context", () => {
  it("propagates across async, isolates nesting", async () => {
    const store = createContextStore();
    const captured = await store.run({ traceId: "T" }, async () => {
      await new Promise((r) => setTimeout(r, 3));
      return store.get().traceId;
    });
    expect(captured).toBe("T");
    expect(store.get().traceId).toBeUndefined();
    store.run({ traceId: "outer" }, () => {
      store.run({ traceId: "inner" }, () => { expect(store.get().traceId).toBe("inner"); });
      expect(store.get().traceId).toBe("outer");
    });
  });
  it("set adds to current context", () => {
    const store = createContextStore();
    store.run({ a: 1 }, () => { store.set("b", 2); expect(store.get()).toEqual({ a: 1, b: 2 }); });
  });
});
