/**
 * RSS フィードとサイトマップ(記事向け)。
 *
 * **実装は `@platform/feed` に移した**(2026-08)。
 * `@platform/seo` にも同じものがあり、**エスケープの関数や `lastmod` の扱いが
 * 微妙に違って**いた——同じサイトで両方使うと不揃いになる。
 *
 * ここは**記事向けの型に合わせた薄い変換**。項目名が違う
 * (`publishedAt` / `guid` ↔ `published` / `id`)ので、そこだけ詰め替える。
 * **新しく書くなら `@platform/feed` から直接**取ること。
 *
 * @packageDocumentation
 */
import {
  buildRssFeed as buildRssFeedCore,
  buildSitemap as buildSitemapCore,
  escapeXml as escapeXmlCore,
  type FeedChannel,
} from "@platform/feed";

/**
 * XML の特殊文字を実体参照にする。
 *
 * **実装は `@platform/feed`。** 忘れると、記事タイトルの `&` ひとつで
 * **フィード全体が読めなくなる**。
 */
export const escapeXml = escapeXmlCore;

/** 記事 1 件(フィード用)。 */
export interface FeedItem {
  /** 表題。 */
  title: string;
  /** 記事の URL(**絶対 URL**)。 */
  link: string;
  /** 要約。 */
  description?: string;
  /** 公開日時(ISO 8601)。 */
  publishedAt?: string;
  /**
   * 一意な識別子(省略時は `link`)。
   *
   * **URL を変えるときはここを固定する。** これが変わると
   * 読み手は**別の記事だと思って再通知**する。
   */
  guid?: string;
  /** 著者名。 */
  author?: string;
}

/** フィード全体の情報。 */
export type FeedMeta = FeedChannel;

/**
 * RSS 2.0 のフィードを作る。
 *
 * **日付は RFC 822 に変換される**(RSS の仕様)。
 *
 * @param meta サイトの情報
 * @param items 記事(**新しい順に並べておくこと**)
 * @returns RSS 2.0 の XML
 */
export function buildRssFeed(meta: FeedMeta, items: FeedItem[]): string {
  // **項目名だけ詰め替える**(`publishedAt` → `published`、`guid` → `id`)
  return buildRssFeedCore(
    meta,
    items.map((i) => ({
      title: i.title,
      link: i.link,
      ...(i.description !== undefined ? { description: i.description } : {}),
      ...(i.publishedAt !== undefined ? { published: i.publishedAt } : {}),
      ...(i.guid !== undefined ? { id: i.guid } : {}),
      ...(i.author !== undefined ? { author: i.author } : {}),
    })),
  );
}

/** サイトマップの 1 件。 */
export interface SitemapUrl {
  /** ページの URL(**絶対 URL**)。 */
  loc: string;
  /** 最終更新(**日付だけに切られる**)。 */
  lastmod?: string;
  /** 更新頻度の目安。 */
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  /** 優先度(0.0〜1.0。**範囲外は丸められる**)。 */
  priority?: number;
}

/**
 * サイトマップ XML を生成する(検索エンジン向け)。
 *
 * **公開しているページだけ**を入れること——下書きや管理画面を載せると、
 * **検索エンジン経由で存在が漏れる**。
 *
 * @param urls ページの一覧
 * @returns sitemap.xml の XML
 */
export function buildSitemap(urls: SitemapUrl[]): string {
  return buildSitemapCore(urls);
}
