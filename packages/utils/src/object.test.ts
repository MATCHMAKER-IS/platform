import { describe, it, expect } from "vitest";
import { pick, omit, deepClone, deepEqual, deepMerge, isEmpty } from "./object";
describe("object utils", () => {
  it("pick/omit", () => {
    expect(pick({ a: 1, b: 2, c: 3 }, ["a", "c"])).toEqual({ a: 1, c: 3 });
    expect(omit({ a: 1, b: 2 }, ["b"])).toEqual({ a: 1 });
  });
  it("deepClone is independent", () => {
    const o = { a: { b: [1, 2] } }; const c = deepClone(o); c.a.b.push(3);
    expect(o.a.b).toHaveLength(2); expect(c.a.b).toHaveLength(3);
  });
  it("deepEqual/deepMerge", () => {
    expect(deepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toBe(true);
    expect(deepMerge({ a: { x: 1, y: 2 } }, { a: { y: 9 } })).toEqual({ a: { x: 1, y: 9 } });
  });
  it("isEmpty", () => {
    expect(isEmpty("")).toBe(true); expect(isEmpty([])).toBe(true); expect(isEmpty({})).toBe(true);
    expect(isEmpty("x")).toBe(false);
  });
});
