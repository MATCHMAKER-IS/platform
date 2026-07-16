import { describe, it, expect } from "vitest";
import { parseUrl, isAbsoluteUrl, buildUrl, getOrigin, getPath } from "./parse";
describe("url parse", () => {
  it("parses and builds", () => {
    const p = parseUrl("https://www.example.com:8080/blog/a?x=1&y=2#top")!;
    expect(p).toMatchObject({ protocol: "https", hostname: "www.example.com", port: "8080", pathname: "/blog/a", search: "x=1&y=2", hash: "top" });
    expect(parseUrl("not a url")).toBeNull();
    expect(parseUrl("/foo", "https://ex.com")!.hostname).toBe("ex.com");
    expect(isAbsoluteUrl("https://x.com")).toBe(true);
    expect(isAbsoluteUrl("/path")).toBe(false);
    expect(buildUrl({ protocol: "https", hostname: "ex.com", pathname: "/a", search: "x=1", hash: "top" })).toBe("https://ex.com/a?x=1#top");
    expect(getOrigin("https://ex.com/a?x=1")).toBe("https://ex.com");
    expect(getPath("https://ex.com/a/b")).toBe("/a/b");
  });
});
