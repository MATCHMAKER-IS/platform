import { describe, it, expect } from "vitest";
import { emptyFavorites, addFavorite, toggleFavorite, isFavorite, favoriteCount, pushRecentlyViewed } from "./favorites";
describe("favorites", () => {
  it("toggles membership", () => {
    let f = toggleFavorite(addFavorite(emptyFavorites(), "A"), "B");
    expect(isFavorite(f, "A")).toBe(true);
    expect(favoriteCount(f)).toBe(2);
    f = toggleFavorite(f, "A");
    expect(isFavorite(f, "A")).toBe(false);
  });
  it("tracks recently viewed", () => {
    expect(pushRecentlyViewed(pushRecentlyViewed(["B"], "A"), "B")).toEqual(["B", "A"]);
    expect(pushRecentlyViewed(["1", "2", "3"], "4", 3)).toEqual(["4", "1", "2"]);
  });
});
