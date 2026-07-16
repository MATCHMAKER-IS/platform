import { describe, it, expect } from "vitest";
import { pMapLimit, pTimeout, TimeoutError } from "./async";
describe("async utils", () => {
  it("pMapLimit preserves order and limits concurrency", async () => {
    let cur = 0, max = 0;
    const r = await pMapLimit([1, 2, 3, 4, 5, 6], async (x) => { cur++; max = Math.max(max, cur); await new Promise((r) => setTimeout(r, 5)); cur--; return x * 2; }, 2);
    expect(r).toEqual([2, 4, 6, 8, 10, 12]);
    expect(max).toBeLessThanOrEqual(2);
  });
  it("pTimeout rejects on timeout", async () => {
    await expect(pTimeout(new Promise((r) => setTimeout(r, 50)), 10)).rejects.toBeInstanceOf(TimeoutError);
  });
});
