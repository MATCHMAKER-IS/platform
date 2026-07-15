import { describe, it, expect } from "vitest";
import { buildRobotsTxt, allowAllRobotsTxt } from "./robots.js";
describe("seo robots", () => {
  it("builds robots.txt", () => {
    const rt = buildRobotsTxt({ rules: [{ userAgent: "*", disallow: ["/admin"], allow: ["/"] }, { userAgent: "Googlebot", crawlDelay: 1 }], sitemaps: ["https://ex.com/sitemap.xml"] });
    expect(rt).toContain("User-agent: *");
    expect(rt).toContain("Disallow: /admin");
    expect(rt).toContain("Crawl-delay: 1");
    expect(rt).toContain("Sitemap: https://ex.com/sitemap.xml");
    expect(allowAllRobotsTxt("https://ex.com/sitemap.xml")).toContain("Allow: /");
  });
});
