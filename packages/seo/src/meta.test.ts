import { describe, it, expect } from "vitest";
import { buildTitle, truncateDescription, robotsContent, escapeAttr, buildMeta, renderMeta, renderMetaTags } from "./meta";
describe("seo meta", () => {
  it("builds title, description, robots", () => {
    expect(buildTitle("記事", "%s | サイト")).toBe("記事 | サイト");
    expect(truncateDescription("あ".repeat(200)).length).toBe(160);
    expect(truncateDescription("a  b\n\nc")).toBe("a b c");
    expect(robotsContent({})).toBe("index, follow");
    expect(robotsContent({ index: false, follow: false })).toBe("noindex, nofollow");
    expect(robotsContent({ noarchive: true, maxSnippet: 50 })).toBe("index, follow, noarchive, max-snippet:50");
    expect(escapeAttr('a"b<c>&d')).toBe("a&quot;b&lt;c&gt;&amp;d");
  });
  it("assembles and renders meta", () => {
    const m = buildMeta({ title: "T", titleTemplate: "%s | S", description: "説明", canonical: "https://ex.com/p", robots: { index: false } });
    expect(m.title).toBe("T | S");
    const html = renderMeta(m);
    expect(html).toContain("<title>T | S</title>");
    expect(html).toContain('rel="canonical" href="https://ex.com/p"');
    expect(renderMetaTags([{ property: "og:title", content: "x" }])).toContain('property="og:title"');
  });
});
