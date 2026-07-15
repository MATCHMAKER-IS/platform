import { describe, it, expect } from "vitest";
import { isPublished, publishedPosts, postsByTag, postsByCategory, tagCounts, relatedPosts } from "./post.js";
const now = new Date("2025-07-25T12:00:00Z");
const posts = [
  { id: "1", slug: "a", title: "A", status: "published" as const, publishedAt: "2025-07-20T00:00:00Z", tags: ["tech", "react"] },
  { id: "2", slug: "b", title: "B", status: "draft" as const, tags: ["tech"] },
  { id: "3", slug: "c", title: "C", status: "scheduled" as const, publishedAt: "2025-08-01T00:00:00Z", tags: ["news"] },
  { id: "4", slug: "d", title: "D", status: "published" as const, publishedAt: "2025-07-24T00:00:00Z", tags: ["react", "tech", "css"], category: "frontend" },
];
describe("post", () => {
  it("resolves publish status", () => {
    expect(isPublished(posts[0]!, now)).toBe(true);
    expect(isPublished(posts[1]!, now)).toBe(false);
    expect(isPublished(posts[2]!, now)).toBe(false);
    expect(publishedPosts(posts, now).map((p) => p.id)).toEqual(["4", "1"]);
  });
  it("filters and relates", () => {
    expect(postsByTag(posts, "react").map((p) => p.id)).toEqual(["1", "4"]);
    expect(postsByCategory(posts, "frontend").map((p) => p.id)).toEqual(["4"]);
    expect(tagCounts(posts)[0]!.count).toBe(3);
    expect(relatedPosts(posts[0]!, posts)[0]!.id).toBe("4");
    expect(relatedPosts(posts[0]!, posts).some((p) => p.id === "1")).toBe(false);
  });
});
