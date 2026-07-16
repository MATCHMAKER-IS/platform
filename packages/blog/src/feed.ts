/**
 * RSS フィード / サイトマップの生成(純ロジック)。
 * 公開記事から RSS 2.0 の XML とサイトマップ URL 一覧を作る。
 * @packageDocumentation
 */

/**
 * XML の特殊文字をエスケープする。
 *
 * **記事タイトルに `&` が入るだけで RSS が壊れる**(リーダーが読めなくなる)。
 * XML に埋め込む値は必ず通す。
 *
 * @param value 対象の文字列
 * @returns エスケープした文字列
 */
export function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** RSS の 1 記事。 */
export interface FeedItem {
  title: string;
  /** 記事の絶対 URL。 */
  link: string;
  /** 概要(抜粋)。 */
  description?: string;
  /** 公開日時(ISO 8601)。 */
  publishedAt?: string;
  /** 一意な識別子(既定は link)。 */
  guid?: string;
}

/** フィードのメタ情報。 */
export interface FeedMeta {
  title: string;
  /** サイト URL。 */
  link: string;
  description: string;
  /** 言語(既定 "ja")。 */
  language?: string;
}

/** ISO 日時を RFC 822(RSS 用)に変換する。 */
function toRfc822(iso: string): string {
  return new Date(iso).toUTCString();
}

/**
 * RSS 2.0 のフィード XML を生成する。
 *
 * @param posts 記事の配列(**公開済みのものだけを渡すこと**)
 * @param options.title / description / baseUrl サイトの情報
 * @returns RSS の XML 文字列
 */
export function buildRssFeed(meta: FeedMeta, items: FeedItem[]): string {
  const entries = items
    .map((item) => {
      const parts = [
        `      <title>${escapeXml(item.title)}</title>`,
        `      <link>${escapeXml(item.link)}</link>`,
        `      <guid isPermaLink="false">${escapeXml(item.guid ?? item.link)}</guid>`,
      ];
      if (item.description) parts.push(`      <description>${escapeXml(item.description)}</description>`);
      if (item.publishedAt) parts.push(`      <pubDate>${toRfc822(item.publishedAt)}</pubDate>`);
      return `    <item>\n${parts.join("\n")}\n    </item>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(meta.title)}</title>
    <link>${escapeXml(meta.link)}</link>
    <description>${escapeXml(meta.description)}</description>
    <language>${escapeXml(meta.language ?? "ja")}</language>
${entries}
  </channel>
</rss>`;
}

/** サイトマップの 1 URL。 */
export interface SitemapUrl {
  loc: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: number;
}

/**
 * サイトマップ XML を生成する(検索エンジン向け)。
 *
 * @param posts 記事の配列(**公開済みのものだけ**)
 * @param baseUrl サイトの URL
 * @returns サイトマップの XML 文字列
 */
export function buildSitemap(urls: SitemapUrl[]): string {
  const entries = urls
    .map((u) => {
      const parts = [`    <loc>${escapeXml(u.loc)}</loc>`];
      if (u.lastmod) parts.push(`    <lastmod>${escapeXml(u.lastmod.slice(0, 10))}</lastmod>`);
      if (u.changefreq) parts.push(`    <changefreq>${u.changefreq}</changefreq>`);
      if (u.priority !== undefined) parts.push(`    <priority>${u.priority.toFixed(1)}</priority>`);
      return `  <url>\n${parts.join("\n")}\n  </url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>`;
}
