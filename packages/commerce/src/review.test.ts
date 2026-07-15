import { describe, it, expect } from "vitest";
import { averageRating, ratingDistribution, ratingSummary } from "./review.js";
describe("review", () => {
  it("aggregates ratings", () => {
    const r = [5, 5, 5, 4, 4, 3, 1];
    expect(averageRating(r)).toBe(3.9);
    expect(averageRating([])).toBe(0);
    expect(ratingDistribution(r)).toMatchObject({ 5: 3, 4: 2, 3: 1, 1: 1, 2: 0 });
    const s = ratingSummary(r);
    expect(s.count).toBe(7);
    expect(Math.abs(s.percentages[5] - 42.9)).toBeLessThan(0.1);
  });
});
