/**
 * `@platform/blog` — ブログ/コンテンツの基盤処理。
 * スラッグ生成・抜粋・読了時間・目次、記事の公開状態/絞り込み/関連記事、RSS/サイトマップ生成。
 * 全文検索は @platform/search(BM25)、本文編集は @platform/ui の RichTextEditor と組み合わせる。
 * @packageDocumentation
 */
export * from "./slug.js";
export * from "./excerpt.js";
export * from "./reading-time.js";
export * from "./toc.js";
export * from "./post.js";
export * from "./feed.js";
export * from "./comment.js";
export * from "./navigation.js";
export * from "./permalink.js";
