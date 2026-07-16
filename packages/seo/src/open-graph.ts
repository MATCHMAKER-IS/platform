/**
 * Open Graph / Twitter Card タグの生成(純ロジック)。
 * SNS でのシェア時に表示されるタイトル・説明・画像などを設定する。
 * @packageDocumentation
 */
import type { MetaTag } from "./meta.js";

/** Open Graph の種類。 */
export type OgType = "website" | "article" | "profile" | "product";

/** Open Graph の入力。 */
export interface OpenGraphInput {
  title: string;
  description?: string;
  /** ページの URL。 */
  url?: string;
  /** シェア画像の URL。 */
  image?: string;
  /** 種類(既定 website)。 */
  type?: OgType;
  /** サイト名。 */
  siteName?: string;
  /** ロケール(既定 ja_JP)。 */
  locale?: string;
  /** article のときの追加情報。 */
  article?: {
    publishedTime?: string;
    modifiedTime?: string;
    author?: string;
    section?: string;
    tags?: string[];
  };
}

/**
 * Open Graph のタグを組み立てる(SNS でシェアされたときの見た目)。
 *
 * **画像は 1200x630 が目安**。小さすぎると SNS 側で表示されない。
 *
 * @param input タイトル・説明・URL・画像・種別
 * @returns メタタグの配列
 */
export function buildOpenGraphTags(input: OpenGraphInput): MetaTag[] {
  const tags: MetaTag[] = [
    { property: "og:title", content: input.title },
    { property: "og:type", content: input.type ?? "website" },
    { property: "og:locale", content: input.locale ?? "ja_JP" },
  ];
  if (input.description) tags.push({ property: "og:description", content: input.description });
  if (input.url) tags.push({ property: "og:url", content: input.url });
  if (input.image) tags.push({ property: "og:image", content: input.image });
  if (input.siteName) tags.push({ property: "og:site_name", content: input.siteName });
  if (input.type === "article" && input.article) {
    const a = input.article;
    if (a.publishedTime) tags.push({ property: "article:published_time", content: a.publishedTime });
    if (a.modifiedTime) tags.push({ property: "article:modified_time", content: a.modifiedTime });
    if (a.author) tags.push({ property: "article:author", content: a.author });
    if (a.section) tags.push({ property: "article:section", content: a.section });
    for (const tag of a.tags ?? []) tags.push({ property: "article:tag", content: tag });
  }
  return tags;
}

/** Twitter Card の種類。 */
export type TwitterCardType = "summary" | "summary_large_image" | "app" | "player";

/** Twitter Card の入力。 */
export interface TwitterCardInput {
  /** カード種類(既定 summary_large_image)。 */
  card?: TwitterCardType;
  title: string;
  description?: string;
  image?: string;
  /** サイトの @ハンドル。 */
  site?: string;
  /** 作成者の @ハンドル。 */
  creator?: string;
}

/**
 * Twitter Card のタグを組み立てる。
 *
 * **OGP があれば多くは補完される**ので、差分だけ指定すればよい。
 *
 * @param input カード種別・タイトル・説明・画像
 * @returns メタタグの配列
 */
export function buildTwitterCardTags(input: TwitterCardInput): MetaTag[] {
  const tags: MetaTag[] = [
    { name: "twitter:card", content: input.card ?? "summary_large_image" },
    { name: "twitter:title", content: input.title },
  ];
  if (input.description) tags.push({ name: "twitter:description", content: input.description });
  if (input.image) tags.push({ name: "twitter:image", content: input.image });
  if (input.site) tags.push({ name: "twitter:site", content: input.site });
  if (input.creator) tags.push({ name: "twitter:creator", content: input.creator });
  return tags;
}
