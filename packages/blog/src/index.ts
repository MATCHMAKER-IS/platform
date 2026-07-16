/**
 * `@platform/blog` — ブログ/コンテンツの基盤処理。
 * スラッグ生成・抜粋・読了時間・目次、記事の公開状態/絞り込み/関連記事、RSS/サイトマップ生成。
 * 全文検索は @platform/search(BM25)、本文編集は @platform/ui の RichTextEditor と組み合わせる。
 * @packageDocumentation
 */
export * from "./slug";
export * from "./excerpt";
export * from "./reading-time";
export * from "./toc";
export * from "./post";
export * from "./feed";
export * from "./comment";
export * from "./navigation";
export * from "./permalink";
