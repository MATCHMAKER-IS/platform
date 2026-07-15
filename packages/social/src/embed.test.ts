import { describe, it, expect } from "vitest";
import { oembedEndpoint, supportsOEmbed } from "./embed.js";
describe("social embed", () => {
  it("builds oembed endpoints", () => {
    expect(oembedEndpoint("x", "https://x.com/y/status/123")).toBe("https://publish.twitter.com/oembed?url=https%3A%2F%2Fx.com%2Fy%2Fstatus%2F123");
    expect(oembedEndpoint("x", "https://x.com/y/status/123", { theme: "dark", omitScript: true }).includes("theme=dark")).toBe(true);
    expect(oembedEndpoint("tiktok", "https://www.tiktok.com/@c/video/71")!.startsWith("https://www.tiktok.com/oembed?url=")).toBe(true);
    expect(oembedEndpoint("instagram", "https://www.instagram.com/p/ABC/")).toBeNull();
    expect(supportsOEmbed("x")).toBe(true);
    expect(supportsOEmbed("instagram")).toBe(false);
  });
});
