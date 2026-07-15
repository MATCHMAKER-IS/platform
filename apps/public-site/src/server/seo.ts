/**
 * 公開ページの SEO メタ生成。@platform/seo に委譲する。
 * @packageDocumentation
 */
import { buildMeta, renderMetaTags, websiteJsonLd, renderJsonLd, breadcrumbJsonLd, type MetaResult } from "@platform/seo";
import { type Page } from "@platform/site";

/** サイト全体の設定。 */
export interface SiteConfig {
  siteName: string;
  baseUrl: string;
}

/** ページの description をブロックから推定する（最初の text ブロック）。 */
function inferDescription(page: Page): string | undefined {
  for (const b of page.blocks) {
    if (b.type === "text" && typeof b.data.text === "string") return b.data.text;
  }
  return undefined;
}

/** ページのメタ情報を組み立てる。 */
export function pageMeta(page: Page, config: SiteConfig): MetaResult {
  const description = inferDescription(page);
  return buildMeta({
    title: page.title,
    titleTemplate: `%s | ${config.siteName}`,
    ...(description ? { description } : {}),
    visibility: "public",
    canonical: `${config.baseUrl}/${page.slug}`,
    openGraph: { title: page.title, type: "website", url: `${config.baseUrl}/${page.slug}`, siteName: config.siteName },
  });
}

/** ページの head に入れる HTML（meta タグ＋JSON-LD）。 */
export function pageHead(page: Page, config: SiteConfig, breadcrumb: { label: string; href: string }[]): string {
  const meta = pageMeta(page, config);
  const website = websiteJsonLd({ name: config.siteName, url: config.baseUrl });
  const crumbs = breadcrumbJsonLd(breadcrumb.map((b) => ({ name: b.label, url: `${config.baseUrl}${b.href}` })));
  return [renderMetaTags(meta.tags), renderJsonLd([website, crumbs])].join("\n");
}
