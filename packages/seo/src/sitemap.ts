/**
 * sitemap.xml の生成（純関数）。
 * @packageDocumentation
 */
import { escapeAttr } from "./meta.js";

/** サイトマップの 1 エントリ。 */
export interface SitemapEntry {
  loc: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: number;
}

/**
 * sitemap.xml を生成する。
 *
 * **公開しているページだけ**を入れること(下書きや管理画面を載せると漏洩する)。
 *
 * @param urls URL の配列(更新日・優先度・更新頻度を指定できる)
 * @returns sitemap.xml の文字列
 */
export function buildSitemap(entries: SitemapEntry[]): string {
  const urls = entries
    .map((e) => {
      const parts = [`    <loc>${escapeAttr(e.loc)}</loc>`];
      if (e.lastmod) parts.push(`    <lastmod>${escapeAttr(e.lastmod)}</lastmod>`);
      if (e.changefreq) parts.push(`    <changefreq>${e.changefreq}</changefreq>`);
      if (e.priority !== undefined) parts.push(`    <priority>${e.priority.toFixed(1)}</priority>`);
      return `  <url>\n${parts.join("\n")}\n  </url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;
}

/**
 * sitemap インデックスを生成する(複数のサイトマップをまとめる)。
 *
 * **1 ファイルに 50,000 URL / 50MB の上限**があるため、大きなサイトでは分割が必要。
 *
 * @param sitemaps サイトマップの URL と更新日
 * @returns sitemap インデックスの XML
 */
export function buildSitemapIndex(sitemaps: { loc: string; lastmod?: string }[]): string {
  const items = sitemaps
    .map((s) => {
      const parts = [`    <loc>${escapeAttr(s.loc)}</loc>`];
      if (s.lastmod) parts.push(`    <lastmod>${escapeAttr(s.lastmod)}</lastmod>`);
      return `  <sitemap>\n${parts.join("\n")}\n  </sitemap>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items}\n</sitemapindex>`;
}
