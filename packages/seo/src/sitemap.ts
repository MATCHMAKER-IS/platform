/**
 * sitemap.xml。
 *
 * **実装は `@platform/feed` に移した**(2026-08)。
 * `@platform/blog` にも同じものがあり、**`lastmod` の扱いが違って**いた
 * (blog は日付だけに切る / seo はそのまま)——同じサイトで両方使うと不揃いになる。
 *
 * ここは**互換のための再公開**。新しく書くなら `@platform/feed` から直接取ること。
 *
 * @packageDocumentation
 */
export { buildSitemap, buildSitemapIndex, type SitemapEntry } from "@platform/feed";
