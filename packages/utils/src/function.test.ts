import { describe, it, expect, vi } from "vitest";
import { debounce, memoize, once, pipe, compose } from "./function";
describe("function utils", () => {
  it("debounce collapses calls", async () => {
    let n = 0; const d = debounce(() => n++, 20);
    d(); d(); d();
    await new Promise((r) => setTimeout(r, 40));
    expect(n).toBe(1);
  });
  it("memoize caches", () => {
    let c = 0; const m = memoize((x: number) => { c++; return x * 2; });
    expect(m(5)).toBe(10); expect(m(5)).toBe(10); expect(c).toBe(1);
  });
  it("once runs once", () => {
    let n = 0; const o = once(() => ++n); o(); o();
    expect(n).toBe(1);
  });
  it("pipe/compose", () => {
    const a = (x: number) => x + 1; const b = (x: number) => x * 2;
    expect(pipe(a, b)(3)).toBe(8);
    expect(compose(a, b)(3)).toBe(7);
  });
});
