import { describe, it, expect } from "vitest";
import { robotsForVisibility, noindexRobots, xRobotsTag, internalRobotsTxt, publicRobotsTxt } from "./indexing.js";
import { robotsContent, buildMeta } from "./meta.js";
describe("seo indexing / visibility", () => {
  it("maps visibility to robots (internal = noindex)", () => {
    expect(robotsContent(robotsForVisibility("internal"))).toBe("noindex, nofollow, noarchive");
    expect(robotsContent(robotsForVisibility("public"))).toBe("index, follow");
    expect(noindexRobots()).toBe("noindex, nofollow, noarchive");
    expect(xRobotsTag("internal")).toBe("noindex, nofollow, noarchive");
    expect(xRobotsTag("public")).toBe("index, follow");
  });
  it("builds internal/public robots.txt", () => {
    expect(internalRobotsTxt()).toContain("Disallow: /");
    expect(internalRobotsTxt()).not.toContain("Allow");
    expect(publicRobotsTxt("https://ex.com/sitemap.xml")).toContain("Allow: /");
    expect(publicRobotsTxt("https://ex.com/sitemap.xml")).toContain("Sitemap:");
  });
  it("integrates visibility into buildMeta", () => {
    expect(buildMeta({ title: "社内", visibility: "internal" }).tags.find((t) => t.name === "robots")!.content).toBe("noindex, nofollow, noarchive");
    expect(buildMeta({ title: "公開", visibility: "public" }).tags.find((t) => t.name === "robots")!.content).toBe("index, follow");
    expect(buildMeta({ title: "x", visibility: "public", robots: { index: false } }).tags.find((t) => t.name === "robots")!.content).toContain("noindex");
    expect(buildMeta({ title: "x" }).tags.some((t) => t.name === "robots")).toBe(false);
  });
});
