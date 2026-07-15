import { describe, it, expect } from "vitest";
import { articleJsonLd, breadcrumbJsonLd, organizationJsonLd, websiteJsonLd, productJsonLd, faqJsonLd, renderJsonLd } from "./json-ld.js";
describe("seo json-ld", () => {
  it("builds article/breadcrumb/website/product/faq", () => {
    const art = articleJsonLd({ headline: "記事", authorName: "著者", publisherName: "S", publisherLogo: "https://ex.com/l.png", url: "https://ex.com/a" });
    expect(art["@type"]).toBe("BlogPosting");
    expect((art.author as { name: string }).name).toBe("著者");
    const bc = breadcrumbJsonLd([{ name: "H", url: "https://ex.com" }, { name: "記事", url: "https://ex.com/a" }]);
    expect((bc.itemListElement as { position: number }[])[1]!.position).toBe(2);
    const web = websiteJsonLd({ name: "S", url: "https://ex.com", searchUrl: "https://ex.com/s?q={search_term_string}" });
    expect((web.potentialAction as { "@type": string })["@type"]).toBe("SearchAction");
    const prod = productJsonLd({ name: "商品", price: 1980, availability: "InStock" });
    expect((prod.offers as { availability: string }).availability).toBe("https://schema.org/InStock");
    expect((faqJsonLd([{ question: "Q", answer: "A" }]).mainEntity as unknown[])).toHaveLength(1);
    expect(organizationJsonLd({ name: "C", url: "https://ex.com", sameAs: ["x"] }).sameAs).toEqual(["x"]);
  });
  it("renders json-ld safely", () => {
    const r = renderJsonLd({ x: "</script>" });
    expect(r.startsWith('<script type="application/ld+json">')).toBe(true);
    expect(r).toContain("\\u003c/script>");
    expect(renderJsonLd([{ a: 1 }, { b: 2 }])).toContain("[");
  });
});
