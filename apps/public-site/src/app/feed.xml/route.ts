/** RSS 2.0 フィード。最新記事を配信する。 */
import { buildRssFeed, type FeedItem } from "@platform/seo";
import { content, siteConfig } from "../../server/content.js";

export async function GET(): Promise<Response> {
  const posts = await content.posts();
  const items: FeedItem[] = posts.map((p) => ({
    title: p.title,
    link: `${siteConfig.baseUrl}/blog/${p.slug}`,
    id: `post:${p.slug}`,
    ...(p.excerpt ? { description: p.excerpt } : {}),
    published: p.publishedAt,
  }));
  const xml = buildRssFeed(
    { title: `${siteConfig.siteName} ブログ`, link: `${siteConfig.baseUrl}/blog`, description: `${siteConfig.siteName} の最新記事`, language: "ja", feedUrl: `${siteConfig.baseUrl}/feed.xml`, ...(posts[0] ? { updated: posts[0].publishedAt } : {}) },
    items,
  );
  return new Response(xml, { headers: { "content-type": "application/rss+xml; charset=utf-8" } });
}
