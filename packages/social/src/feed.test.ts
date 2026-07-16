import { describe, it, expect } from "vitest";
import { postKey, mergeSocialFeed, filterByPlatform, groupByPlatform, latestPerPlatform, newPosts, recentPosts } from "./feed";
const posts = [
  { platform: "x" as const, id: "1", url: "u1", createdAt: "2025-07-20T10:00:00Z" },
  { platform: "tiktok" as const, id: "10", url: "u10", createdAt: "2025-07-25T10:00:00Z" },
  { platform: "x" as const, id: "2", url: "u2", createdAt: "2025-07-24T10:00:00Z" },
  { platform: "x" as const, id: "1", url: "dup", createdAt: "2025-07-20T10:00:00Z" },
  { platform: "instagram" as const, id: "100", url: "u100", createdAt: "2025-07-22T10:00:00Z" },
];
describe("social feed", () => {
  it("merges, dedupes, sorts", () => {
    expect(postKey({ platform: "x", id: "1" })).toBe("x:1");
    const merged = mergeSocialFeed(posts);
    expect(merged).toHaveLength(4);
    expect(merged[0]!.id).toBe("10");
    expect(filterByPlatform(posts, "x")).toHaveLength(3);
    expect(groupByPlatform(merged).x).toHaveLength(2);
    expect(latestPerPlatform(posts)).toHaveLength(3);
    expect(newPosts(posts, ["x:1", "x:2"]).some((p) => p.id === "1")).toBe(false);
    expect(recentPosts(posts, 2).map((p) => p.id)).toEqual(["10", "2"]);
  });
});
