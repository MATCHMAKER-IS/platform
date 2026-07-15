import { describe, it, expect } from "vitest";
import { buildPermalink, joinUrl, postUrl, matchPermalink, PERMALINK_PRESETS } from "./permalink.js";
const post = { slug: "hello-world", id: "123", category: "技術ブログ", publishedAt: "2025-07-25T10:00:00Z" };
describe("permalink", () => {
  it("builds paths from patterns", () => {
    expect(buildPermalink("/blog/:slug", post)).toBe("/blog/hello-world");
    expect(buildPermalink("/:year/:month/:day/:slug", post)).toBe("/2025/07/25/hello-world");
    expect(buildPermalink(PERMALINK_PRESETS.numeric, post)).toBe("/archives/123");
    expect(buildPermalink("/:category/:slug", post)).toBe("/hello-world");
    expect(buildPermalink("/:category/:slug", post, { allowUnicode: true })).toBe("/技術ブログ/hello-world");
  });
  it("handles timezone for date tokens", () => {
    const late = { slug: "night", publishedAt: "2025-07-25T23:00:00Z" };
    expect(buildPermalink("/:year/:month/:day/:slug", late)).toBe("/2025/07/25/night");
    expect(buildPermalink("/:year/:month/:day/:slug", late, { utcOffsetMinutes: 540 })).toBe("/2025/07/26/night");
  });
  it("joins urls and builds absolute post url", () => {
    expect(joinUrl("https://ex.com/", "/blog/a")).toBe("https://ex.com/blog/a");
    expect(joinUrl("https://ex.com", "blog/a")).toBe("https://ex.com/blog/a");
    expect(postUrl(post, { baseUrl: "https://ex.com", pattern: "/blog/:year/:slug" })).toBe("https://ex.com/blog/2025/hello-world");
  });
  it("matches paths back to tokens", () => {
    expect(matchPermalink("/blog/:year/:month/:slug", "/blog/2025/07/hello")).toEqual({ year: "2025", month: "07", slug: "hello" });
    expect(matchPermalink("/blog/:slug", "/news/hello")).toBeNull();
    expect(matchPermalink("/blog/:slug", "/blog/2025/hello")).toBeNull();
    expect(matchPermalink("/:slug", "/%E6%97%A5%E6%9C%AC?x=1")!.slug).toBe("日本");
  });
});
