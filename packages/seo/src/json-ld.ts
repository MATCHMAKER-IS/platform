/**
 * JSON-LD 構造化データ(schema.org)の生成(純ロジック)。
 * 記事・パンくず・組織・サイト(検索ボックス)・商品・FAQ のリッチリザルト用データを作る。
 * 生成したオブジェクトは renderJsonLd で <script type="application/ld+json"> に変換する。
 * @packageDocumentation
 */

/** JSON-LD オブジェクト(schema.org)。 */
export type JsonLd = Record<string, unknown>;

/** 記事(Article / BlogPosting)。 */
export function articleJsonLd(input: {
  headline: string;
  description?: string;
  image?: string | string[];
  datePublished?: string;
  dateModified?: string;
  authorName?: string;
  publisherName?: string;
  publisherLogo?: string;
  url?: string;
  type?: "Article" | "BlogPosting" | "NewsArticle";
}): JsonLd {
  const ld: JsonLd = { "@context": "https://schema.org", "@type": input.type ?? "BlogPosting", headline: input.headline };
  if (input.description) ld.description = input.description;
  if (input.image) ld.image = input.image;
  if (input.datePublished) ld.datePublished = input.datePublished;
  if (input.dateModified) ld.dateModified = input.dateModified;
  if (input.authorName) ld.author = { "@type": "Person", name: input.authorName };
  if (input.publisherName) {
    const publisher: JsonLd = { "@type": "Organization", name: input.publisherName };
    if (input.publisherLogo) publisher.logo = { "@type": "ImageObject", url: input.publisherLogo };
    ld.publisher = publisher;
  }
  if (input.url) ld.mainEntityOfPage = { "@type": "WebPage", "@id": input.url };
  return ld;
}

/** パンくずリスト(BreadcrumbList)。 */
export function breadcrumbJsonLd(items: { name: string; url: string }[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/** 組織(Organization)。 */
export function organizationJsonLd(input: { name: string; url: string; logo?: string; sameAs?: string[] }): JsonLd {
  const ld: JsonLd = { "@context": "https://schema.org", "@type": "Organization", name: input.name, url: input.url };
  if (input.logo) ld.logo = input.logo;
  if (input.sameAs && input.sameAs.length > 0) ld.sameAs = input.sameAs;
  return ld;
}

/** サイト(WebSite)。searchUrl 指定で検索ボックス(Sitelinks Searchbox)を付与。 */
export function websiteJsonLd(input: { name: string; url: string; searchUrl?: string }): JsonLd {
  const ld: JsonLd = { "@context": "https://schema.org", "@type": "WebSite", name: input.name, url: input.url };
  if (input.searchUrl) {
    ld.potentialAction = {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: input.searchUrl },
      "query-input": "required name=search_term_string",
    };
  }
  return ld;
}

/** 商品(Product)。EC の商品ページ用。 */
export function productJsonLd(input: {
  name: string;
  description?: string;
  image?: string | string[];
  sku?: string;
  brand?: string;
  price?: number;
  currency?: string;
  availability?: "InStock" | "OutOfStock" | "PreOrder";
  url?: string;
}): JsonLd {
  const ld: JsonLd = { "@context": "https://schema.org", "@type": "Product", name: input.name };
  if (input.description) ld.description = input.description;
  if (input.image) ld.image = input.image;
  if (input.sku) ld.sku = input.sku;
  if (input.brand) ld.brand = { "@type": "Brand", name: input.brand };
  if (input.price !== undefined) {
    ld.offers = {
      "@type": "Offer",
      price: input.price,
      priceCurrency: input.currency ?? "JPY",
      availability: `https://schema.org/${input.availability ?? "InStock"}`,
      ...(input.url ? { url: input.url } : {}),
    };
  }
  return ld;
}

/** FAQ ページ(FAQPage)。よくある質問のリッチリザルト用。 */
export function faqJsonLd(qa: { question: string; answer: string }[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: qa.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

/**
 * JSON-LD を <script type="application/ld+json"> タグに変換する。
 * XSS 対策として < を \u003c にエスケープする(script 終了タグ注入の防止)。
 */
export function renderJsonLd(ld: JsonLd | JsonLd[]): string {
  const json = JSON.stringify(ld).replace(/</g, "\\u003c");
  return `<script type="application/ld+json">${json}</script>`;
}
