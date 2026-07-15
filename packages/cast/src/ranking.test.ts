import { describe, it, expect } from "vitest";
import { weightedRating, globalMeanRating, rankCasts, rankByRawRating } from "./ranking.js";
describe("cast ranking", () => {
  it("computes weighted rating (bayesian)", () => {
    const mean = 4.0, m = 10;
    expect(weightedRating(5.0, 1, m, mean)).toBeLessThan(weightedRating(4.8, 100, m, mean));
    expect(weightedRating(0, 0, 10, 4.0)).toBe(4.0);
    expect(Math.abs(weightedRating(4.5, 10000, 10, 3.0) - 4.5)).toBeLessThan(0.01);
  });
  it("ranks casts, review-aware", () => {
    const casts = [
      { id: "1", name: "あおい", status: "active" as const, rating: 5.0, reviewCount: 2 },
      { id: "2", name: "かえで", status: "active" as const, rating: 4.7, reviewCount: 150 },
      { id: "3", name: "みなと", status: "active" as const, rating: 4.9, reviewCount: 80 },
      { id: "4", name: "さくら", status: "hidden" as const, rating: 5.0, reviewCount: 200 },
    ];
    expect(globalMeanRating(casts)).toBeGreaterThan(4.6);
    const ranking = rankCasts(casts, { minCount: 10 });
    expect(ranking).toHaveLength(3);
    expect(ranking[0]!.cast.id).not.toBe("1");
    expect(ranking[0]!.rank).toBe(1);
    expect(rankByRawRating(casts)[0]!.cast.id).toBe("1");
  });
});
