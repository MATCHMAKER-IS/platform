/**
 * RSS 2.0 / Atom フィードの生成（純関数）。
 * @packageDocumentation
 */

/** XML テキストエスケープ（要素・属性共通）。 */
function xmlEscape(input: string): string {
  return input.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

/** フィードのチャンネル情報。 */
export interface FeedChannel {
  title: string;
  /** サイト URL。 */
  link: string;
  description: string;
  /** 言語（RSS、例 "ja"）。 */
  language?: string;
  /** 最終更新（ISO）。 */
  updated?: string;
  /** フィード自身の URL（Atom self link）。 */
  feedUrl?: string;
}

/** フィードの項目。 */
export interface FeedItem {
  title: string;
  link: string;
  /** 一意 ID（未指定は link）。 */
  id?: string;
  description?: string;
  /** 公開日時（ISO）。 */
  published?: string;
  updated?: string;
  author?: string;
}

function toRfc822(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toUTCString();
}

/**
 * RSS 2.0 のフィードを生成する。
 *
 * @param input サイト情報と記事の配列
 * @returns RSS の XML 文字列(**値はエスケープ済み**)
 */
export function buildRssFeed(channel: FeedChannel, items: FeedItem[]): string {
  const chParts = [
    `    <title>${xmlEscape(channel.title)}</title>`,
    `    <link>${xmlEscape(channel.link)}</link>`,
    `    <description>${xmlEscape(channel.description)}</description>`,
  ];
  if (channel.language) chParts.push(`    <language>${xmlEscape(channel.language)}</language>`);
  if (channel.updated) chParts.push(`    <lastBuildDate>${toRfc822(channel.updated)}</lastBuildDate>`);
  if (channel.feedUrl) chParts.push(`    <atom:link href="${xmlEscape(channel.feedUrl)}" rel="self" type="application/rss+xml"/>`);
  const itemXml = items
    .map((it) => {
      const parts = [
        `      <title>${xmlEscape(it.title)}</title>`,
        `      <link>${xmlEscape(it.link)}</link>`,
        `      <guid isPermaLink="false">${xmlEscape(it.id ?? it.link)}</guid>`,
      ];
      if (it.description) parts.push(`      <description>${xmlEscape(it.description)}</description>`);
      if (it.published) parts.push(`      <pubDate>${toRfc822(it.published)}</pubDate>`);
      if (it.author) parts.push(`      <author>${xmlEscape(it.author)}</author>`);
      return `    <item>\n${parts.join("\n")}\n    </item>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n  <channel>\n${chParts.join("\n")}\n${itemXml}\n  </channel>\n</rss>`;
}

/**
 * Atom のフィードを生成する。
 *
 * RSS より仕様が厳密。**どちらか一方でよい**(両方出す必要はない)。
 *
 * @param input サイト情報と記事の配列
 * @returns Atom の XML 文字列
 */
export function buildAtomFeed(channel: FeedChannel, items: FeedItem[]): string {
  const updated = channel.updated ?? items[0]?.updated ?? items[0]?.published ?? new Date().toISOString();
  const head = [
    `  <title>${xmlEscape(channel.title)}</title>`,
    `  <link href="${xmlEscape(channel.link)}"/>`,
    channel.feedUrl ? `  <link href="${xmlEscape(channel.feedUrl)}" rel="self"/>` : "",
    `  <id>${xmlEscape(channel.link)}</id>`,
    `  <updated>${new Date(updated).toISOString()}</updated>`,
    `  <subtitle>${xmlEscape(channel.description)}</subtitle>`,
  ].filter(Boolean);
  const entries = items
    .map((it) => {
      const when = it.updated ?? it.published ?? updated;
      const parts = [
        `    <title>${xmlEscape(it.title)}</title>`,
        `    <link href="${xmlEscape(it.link)}"/>`,
        `    <id>${xmlEscape(it.id ?? it.link)}</id>`,
        `    <updated>${new Date(when).toISOString()}</updated>`,
      ];
      if (it.published) parts.push(`    <published>${new Date(it.published).toISOString()}</published>`);
      if (it.description) parts.push(`    <summary>${xmlEscape(it.description)}</summary>`);
      if (it.author) parts.push(`    <author><name>${xmlEscape(it.author)}</name></author>`);
      return `  <entry>\n${parts.join("\n")}\n  </entry>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<feed xmlns="http://www.w3.org/2005/Atom">\n${head.join("\n")}\n${entries}\n</feed>`;
}
