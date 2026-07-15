import { describe, it, expect } from "vitest";
import { normalizeHandle, canonicalHandle, isValidHandle, displayHandle, buildProfileUrl } from "./handle.js";
describe("social handle", () => {
  it("normalizes and validates", () => {
    expect(normalizeHandle("@yamada_taro")).toBe("yamada_taro");
    expect(canonicalHandle("@YamadaTaro")).toBe("yamadataro");
    expect(isValidHandle("x", "yamada_taro")).toBe(true);
    expect(isValidHandle("x", "toolong_handle_over15")).toBe(false);
    expect(isValidHandle("x", "bad-handle")).toBe(false);
    expect(isValidHandle("tiktok", "cast.01")).toBe(true);
    expect(isValidHandle("tiktok", "a")).toBe(false);
    expect(displayHandle("tiktok", "cast01")).toBe("@cast01");
    expect(displayHandle("x", "cast01")).toBe("cast01");
  });
  it("builds profile urls", () => {
    expect(buildProfileUrl("x", "@yamada")).toBe("https://x.com/yamada");
    expect(buildProfileUrl("tiktok", "cast01")).toBe("https://www.tiktok.com/@cast01");
    expect(buildProfileUrl("instagram", "cast_ig")).toBe("https://www.instagram.com/cast_ig");
    expect(buildProfileUrl("x", "bad handle!")).toBeNull();
  });
});
