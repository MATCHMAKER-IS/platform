/**
 * RSS / Atom フィード。
 *
 * **実装は `@platform/feed` に移した**(2026-08)。
 * `@platform/blog` にも同じものがあり、**エスケープの関数や日付の形式が
 * 微妙に違って**いた——同じサイトで両方使うと不揃いになる。
 *
 * ここは**互換のための再公開**。新しく書くなら `@platform/feed` から直接取ること。
 *
 * @packageDocumentation
 */
export {
  buildRssFeed,
  buildAtomFeed,
  escapeXml,
  type FeedEntry,
  type FeedChannel,
} from "@platform/feed";

/**
 * フィードの 1 件。
 *
 * **`@platform/feed` の `FeedEntry` と同じ。** 旧名を残してある。
 */
export type { FeedEntry as FeedItem } from "@platform/feed";
