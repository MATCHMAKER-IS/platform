import { describe, it, expect } from "vitest";
import { normalizeUrl, urlsEqual } from "./normalize";
describe("url normalize", () => {
  it("normalizes host, query, trailing slash, tracking", () => {
    expect(normalizeUrl("https://EXAMPLE.com/Path")).toBe("https://example.com/Path");
    expect(normalizeUrl("https://ex.com/a?id=1&utm_source=x&fbclid=y")).toBe("https://ex.com/a?id=1");
    expect(normalizeUrl("https://ex.com/a?c=3&a=1&b=2")).toBe("https://ex.com/a?a=1&b=2&c=3");
    expect(normalizeUrl("https://ex.com/blog/")).toBe("https://ex.com/blog");
    expect(normalizeUrl("https://ex.com/")).toBe("https://ex.com/");
    expect(normalizeUrl("https://www.ex.com/a", { stripWww: true })).toBe("https://ex.com/a");
    expect(normalizeUrl("https://ex.com/a#top", { stripHash: true })).toBe("https://ex.com/a");
    expect(urlsEqual("https://EX.com/a/?utm_source=x", "https://ex.com/a")).toBe(true);
  });
});
