import { describe, it, expect } from "vitest";
import { adjacentPosts, seriesPosts, seriesNavigation } from "./navigation.js";
const posts = [
  { id: "1", slug: "a", title: "A", status: "published" as const, publishedAt: "2025-07-20T00:00:00Z", series: "入門", seriesOrder: 1 },
  { id: "2", slug: "b", title: "B", status: "published" as const, publishedAt: "2025-07-22T00:00:00Z", series: "入門", seriesOrder: 2 },
  { id: "3", slug: "c", title: "C", status: "published" as const, publishedAt: "2025-07-24T00:00:00Z", series: "入門", seriesOrder: 3 },
];
describe("navigation", () => {
  it("finds adjacent and series posts", () => {
    const adj = adjacentPosts(posts, "2");
    expect(adj.newer!.id).toBe("3");
    expect(adj.older!.id).toBe("1");
    expect(seriesPosts(posts, "入門").map((p) => p.id)).toEqual(["1", "2", "3"]);
    const sn = seriesNavigation(posts, "2");
    expect(sn.prev!.id).toBe("1");
    expect(sn.next!.id).toBe("3");
    expect(sn.total).toBe(3);
  });
});
