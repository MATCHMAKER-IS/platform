import { describe, it, expect } from "vitest";
import { levenshtein, levenshteinSimilarity, jaro, jaroWinkler, bestMatch } from "./similarity";

describe("similarity", () => {
  it("levenshtein", () => { expect(levenshtein("kitten", "sitting")).toBe(3); expect(levenshtein("東京", "東今")).toBe(1); expect(levenshtein("", "abc")).toBe(3); });
  it("levenshteinSimilarity", () => expect(levenshteinSimilarity("a", "a")).toBe(1));
  it("jaro/jaroWinkler known values", () => { expect(jaro("MARTHA", "MARHTA")).toBeCloseTo(0.9444, 3); expect(jaroWinkler("MARTHA", "MARHTA")).toBeCloseTo(0.9611, 3); });
  it("bestMatch fuzzy", () => { expect(bestMatch("tokyo", ["tokio", "osaka"])!.value).toBe("tokio"); expect(bestMatch("zzz", ["aaa"], { threshold: 0.9 })).toBeNull(); });
});
