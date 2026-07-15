/** sitemap.xml。全公開ページを列挙する。 */
import { buildSitemap, type SitemapEntry } from "@platform/seo";
import { content, siteConfig } from "../../server/content.js";

export async function GET(): Promise<Response> {
  const pages = await content.pages();
  const entries: SitemapEntry[] = pages.map((p) => ({
    loc: `${siteConfig.baseUrl}/${p.slug}`,
    changefreq: p.slug === "" ? "daily" : "weekly",
    priority: p.slug === "" ? 1.0 : 0.7,
  }));
  const body = buildSitemap(entries);
  return new Response(body, { headers: { "content-type": "application/xml; charset=utf-8" } });
}
