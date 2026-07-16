import { describe, it, expect } from "vitest";
import { activeCasts, castsByTag, castsByAllTags, tagCounts, isNewcomer, newcomers, sortCasts, featuredCasts } from "./cast";
const now = new Date("2025-07-25T00:00:00Z");
const casts = [
  { id: "1", name: "あおい", status: "active" as const, tags: ["ダンス", "歌"], featured: true, rating: 4.8, joinedAt: "2025-01-01" },
  { id: "2", name: "かえで", status: "active" as const, tags: ["トーク"], rating: 4.2, joinedAt: "2025-07-10" },
  { id: "3", name: "さくら", status: "hidden" as const, tags: ["ダンス"], rating: 5.0 },
  { id: "4", name: "みなと", status: "active" as const, tags: ["ダンス", "トーク"], rating: 4.5, joinedAt: "2024-06-01" },
];
describe("cast", () => {
  it("filters and counts tags", () => {
    expect(activeCasts(casts)).toHaveLength(3);
    expect(castsByTag(casts, "ダンス").map((c) => c.id).sort()).toEqual(["1", "3", "4"]);
    expect(castsByAllTags(casts, ["ダンス", "トーク"]).map((c) => c.id)).toEqual(["4"]);
    expect(tagCounts(casts)[0]).toEqual({ tag: "ダンス", count: 3 });
  });
  it("finds newcomers and sorts", () => {
    expect(isNewcomer(casts[1]!, 30, now)).toBe(true);
    expect(newcomers(casts, 30, now).map((c) => c.id)).toEqual(["2"]);
    expect(sortCasts(casts, "featured", now).map((c) => c.id)).toEqual(["1", "4", "2"]);
    expect(sortCasts(casts, "newest", now)[0]!.id).toBe("2");
    expect(featuredCasts(casts).map((c) => c.id)).toEqual(["1"]);
  });
});
