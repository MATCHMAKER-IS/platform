import { describe, it, expect } from "vitest";
import { sortBy, partition, keyBy, zip, range, difference, intersection, compact } from "./array.js";
describe("array utils", () => {
  it("sortBy stable", () => {
    expect(sortBy([{ n: 3 }, { n: 1 }, { n: 2 }], (x) => x.n).map((x) => x.n)).toEqual([1, 2, 3]);
  });
  it("partition/keyBy", () => {
    expect(partition([1, 2, 3, 4], (x) => x % 2 === 0)).toEqual([[2, 4], [1, 3]]);
    expect(keyBy([{ id: "a" }], (x) => x.id)).toEqual({ a: { id: "a" } });
  });
  it("zip/range", () => {
    expect(zip([1, 2], ["a", "b"])).toEqual([[1, "a"], [2, "b"]]);
    expect(range(1, 5)).toEqual([1, 2, 3, 4]);
    expect(range(5, 0, -1)).toEqual([5, 4, 3, 2, 1]);
  });
  it("set ops", () => {
    expect(difference([1, 2, 3], [2])).toEqual([1, 3]);
    expect(intersection([1, 2, 3], [2, 3, 4])).toEqual([2, 3]);
    expect(compact([1, 0, 2, null, ""])).toEqual([1, 2]);
  });
});
