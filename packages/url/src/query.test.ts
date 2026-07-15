import { describe, it, expect } from "vitest";
import { parseQuery, stringifyQuery, getParam, setParam, setParams, appendParam, removeParam, hasParam, keepParams } from "./query.js";
describe("url query", () => {
  it("parses and stringifies", () => {
    expect(parseQuery("?a=1&b=2&a=3")).toEqual({ a: ["1", "3"], b: "2" });
    expect(stringifyQuery({ b: 2, a: 1, c: [1, 2] })).toBe("a=1&b=2&c=1&c=2");
    expect(stringifyQuery({ a: 1, b: null, c: undefined })).toBe("a=1");
  });
  it("manipulates params preserving the url", () => {
    expect(setParam("https://ex.com/a?x=1#top", "x", "9")).toBe("https://ex.com/a?x=9#top");
    expect(setParam("https://ex.com/a", "page", 2)).toBe("https://ex.com/a?page=2");
    expect(setParams("https://ex.com/a?x=1&y=2", { x: 9, y: null, z: 3 })).toBe("https://ex.com/a?x=9&z=3");
    expect(appendParam("https://ex.com/a?tag=1", "tag", 2)).toBe("https://ex.com/a?tag=1&tag=2");
    expect(removeParam("https://ex.com/a?x=1&y=2", "x")).toBe("https://ex.com/a?y=2");
    expect(getParam("https://ex.com/a?x=1&y=2", "y")).toBe("2");
    expect(hasParam("https://ex.com/a?x=1", "z")).toBe(false);
    expect(keepParams("https://ex.com/a?x=1&y=2&z=3", ["x", "z"])).toBe("https://ex.com/a?x=1&z=3");
    expect(setParam("/search?q=old", "q", "new")).toBe("/search?q=new");
  });
});
