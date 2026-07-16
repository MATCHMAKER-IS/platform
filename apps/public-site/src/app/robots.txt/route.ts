/** robots.txt。公開サイトなのでクロール許可＋sitemap を提示。 */
import { buildRobotsTxt } from "@platform/seo";
import { siteConfig } from "../../server/content";

export function GET(): Response {
  const body = buildRobotsTxt({
    rules: [{ userAgent: "*", allow: ["/"] }],
    sitemaps: [`${siteConfig.baseUrl}/sitemap.xml`],
  });
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8" } });
}
