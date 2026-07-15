/**
 * `@platform/seo` — SEO のための機能。
 * メタタグ(title/description/canonical/robots)、Open Graph / Twitter Card、
 * JSON-LD 構造化データ(記事/パンくず/組織/サイト/商品/FAQ)、robots.txt の生成。
 * サイトマップ・RSS は @platform/blog、スラッグは @platform/blog を利用。
 * @packageDocumentation
 */
export * from "./meta.js";
export * from "./open-graph.js";
export * from "./json-ld.js";
export * from "./robots.js";
export * from "./indexing.js";
export * from "./sitemap.js";
export * from "./favicon.js";
export * from "./feed.js";
