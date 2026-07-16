import { describe, it, expect } from "vitest";
import { joinUrl, parseQuery, buildQuery, withQuery } from "./url";

describe("url", () => {
  it("joinUrl", () => expect(joinUrl("https://x.jp/", "/v1/", "/u")).toBe("https://x.jp/v1/u"));
  it("parseQuery", () => expect(parseQuery("?a=1&b=hello%20world")).toEqual({ a: "1", b: "hello world" }));
  it("buildQuery sorts, drops null", () => expect(buildQuery({ b: 2, a: 1, c: null })).toBe("a=1&b=2"));
  it("withQuery merges + keeps hash", () => expect(withQuery("https://x.jp/p?a=1#h", { b: 2, a: 9 })).toBe("https://x.jp/p?a=9&b=2#h"));
});
