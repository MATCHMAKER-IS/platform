import { describe, it, expect } from "vitest";
import { parseSocialUrl, isSocialUrl } from "./parse";
describe("social parse", () => {
  it("parses profiles", () => {
    expect(parseSocialUrl("https://x.com/yamada_taro")).toMatchObject({ platform: "x", type: "profile", handle: "yamada_taro" });
    expect(parseSocialUrl("https://www.tiktok.com/@cast01")).toMatchObject({ platform: "tiktok", type: "profile", handle: "cast01" });
    expect(parseSocialUrl("https://www.instagram.com/cast_ig/")).toMatchObject({ platform: "instagram", type: "profile", handle: "cast_ig" });
  });
  it("parses posts", () => {
    expect(parseSocialUrl("https://twitter.com/y/status/1234567890")).toMatchObject({ type: "post", handle: "y", postId: "1234567890", postKind: "tweet" });
    expect(parseSocialUrl("https://www.tiktok.com/@c/video/7100000000000000000")).toMatchObject({ type: "post", postId: "7100000000000000000", postKind: "video" });
    expect(parseSocialUrl("https://www.instagram.com/p/ABC123xyz/")).toMatchObject({ type: "post", postId: "ABC123xyz", postKind: "post" });
    expect(parseSocialUrl("https://www.instagram.com/reel/XYZ789/")!.postKind).toBe("reel");
  });
  it("rejects non-social and reserved paths", () => {
    expect(parseSocialUrl("https://example.com/foo")).toBeNull();
    expect(parseSocialUrl("https://x.com/home")).toBeNull();
    expect(isSocialUrl("https://x.com/yamada")).toBe(true);
    expect(isSocialUrl("not a url")).toBe(false);
  });
});
