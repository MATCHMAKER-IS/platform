import { describe, it, expect } from "vitest";
import { buildOpenGraphTags, buildTwitterCardTags } from "./open-graph";
describe("seo open graph / twitter", () => {
  it("builds og tags with article extension", () => {
    const og = buildOpenGraphTags({ title: "記事", type: "article", image: "https://ex.com/i.png", article: { publishedTime: "2025-07-25T00:00:00Z", tags: ["a", "b"] } });
    expect(og.some((t) => t.property === "og:title" && t.content === "記事")).toBe(true);
    expect(og.some((t) => t.property === "og:type" && t.content === "article")).toBe(true);
    expect(og.some((t) => t.property === "og:locale" && t.content === "ja_JP")).toBe(true);
    expect(og.filter((t) => t.property === "article:tag")).toHaveLength(2);
  });
  it("builds twitter card tags", () => {
    const tw = buildTwitterCardTags({ title: "記事", image: "https://ex.com/i.png", site: "@site" });
    expect(tw.some((t) => t.name === "twitter:card" && t.content === "summary_large_image")).toBe(true);
    expect(tw.some((t) => t.name === "twitter:site")).toBe(true);
  });
});
