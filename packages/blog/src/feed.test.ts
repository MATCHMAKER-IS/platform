import { describe, it, expect } from "vitest";
import { buildRssFeed, buildSitemap, escapeXml } from "./feed.js";
describe("feed", () => {
  it("builds RSS with escaping", () => {
    const rss = buildRssFeed({ title: "My Blog", link: "https://ex.com", description: "説明" }, [{ title: "記事<A>", link: "https://ex.com/a", description: "抜粋&要約", publishedAt: "2025-07-20T00:00:00Z" }]);
    expect(rss).toContain("<title>My Blog</title>");
    expect(rss).toContain("記事&lt;A&gt;");
    expect(rss).toContain("抜粋&amp;要約");
    expect(rss).toContain("<pubDate>");
    expect(rss.startsWith("<?xml")).toBe(true);
  });
  it("builds sitemap", () => {
    const sm = buildSitemap([{ loc: "https://ex.com/a", lastmod: "2025-07-20T00:00:00Z", changefreq: "weekly", priority: 0.8 }]);
    expect(sm).toContain("<loc>https://ex.com/a</loc>");
    expect(sm).toContain("<lastmod>2025-07-20</lastmod>");
    expect(sm).toContain("<priority>0.8</priority>");
    expect(escapeXml('a<b>&"c"')).toBe("a&lt;b&gt;&amp;&quot;c&quot;");
  });
});
