/**
 * `@platform/seo` — SEO のための機能。
 * メタタグ(title/description/canonical/robots)、Open Graph / Twitter Card、
 * JSON-LD 構造化データ(記事/パンくず/組織/サイト/商品/FAQ)、robots.txt の生成。
 * サイトマップ・RSS は @platform/blog、スラッグは @platform/blog を利用。
 * @packageDocumentation
 */
export * from "./meta";
export * from "./open-graph";
export * from "./json-ld";
export * from "./robots";
export * from "./indexing";
export * from "./sitemap";
export * from "./favicon";
export * from "./feed";
