# @platform/blog

ブログ/コンテンツの基盤処理。スラッグ生成・抜粋・読了時間・目次、記事の公開状態/絞り込み/関連記事、
RSS・サイトマップ生成。全文検索は `@platform/search`(BM25)、本文編集は `@platform/ui` の
`RichTextEditor` と組み合わせます。すべて純ロジックで保存や画面はアプリ側。

## スラッグ・抜粋・読了時間・目次
```ts
import { slugify, ensureSlug, uniqueSlug, excerpt, readingTime, extractHeadings } from "@platform/blog";

slugify("Hello World!");                          // "hello-world"
slugify("こんにちは 世界", { allowUnicode: true }); // "こんにちは-世界"
ensureSlug(title, postId);                         // 日本語で空になる場合は ID を使う
uniqueSlug("hello", existingSlugs);                // 衝突時は hello-2, hello-3...

excerpt(markdown, { maxLength: 120 });             // 記法を除いた抜粋(語境界で丸め)
readingTime(markdown);                             // { minutes, cjkChars, words } 日本語/欧文対応
extractHeadings(markdown, { allowUnicode: true }); // 目次(見出し+アンカー・重複回避)
```

## 記事の公開・絞り込み・関連記事
```ts
import { publishedPosts, postsByTag, tagCounts, relatedPosts, isPublished } from "@platform/blog";

const live = publishedPosts(posts);        // 下書き/予約未来を除外し公開日の新しい順
postsByTag(posts, "react");                // タグ絞り込み
tagCounts(posts);                          // タグクラウド(多い順)
relatedPosts(currentPost, posts, 5);       // 共有タグ数の多い順で関連記事
```
`scheduled`(予約公開)は公開日時を過ぎると自動で公開扱いになります。

## RSS・サイトマップ
```ts
import { buildRssFeed, buildSitemap } from "@platform/blog";

const rss = buildRssFeed({ title: "ブログ", link: "https://example.com", description: "..." },
  live.map((p) => ({ title: p.title, link: `https://example.com/blog/${p.slug}`, description: excerpt(p.body), publishedAt: p.publishedAt })));

const sitemap = buildSitemap(live.map((p) => ({ loc: `https://example.com/blog/${p.slug}`, lastmod: p.publishedAt, changefreq: "weekly", priority: 0.7 })));
```
XML の特殊文字は自動エスケープ。`/feed.xml`・`/sitemap.xml` として配信できます。

## 全文検索(@platform/search)
```ts
import { createBm25Index } from "@platform/search";
const index = createBm25Index(live.map((p) => ({ id: p.slug, text: `${p.title} ${excerpt(p.body, { maxLength: 500 })}` })));
index.search("キーワード");
```

## コメント(ネスト・モデレーション)
```ts
import { buildCommentTree, approvedComments, sortComments, pendingCount } from "@platform/blog";
const tree = buildCommentTree(approvedComments(comments));   // 承認済みを親子ツリーに
sortComments(comments, "newest");                            // 並び替え
pendingCount(comments);                                      // 承認待ち件数(モデレーション)
```

## 記事ナビゲーション(前後・連載)
```ts
import { adjacentPosts, seriesPosts, seriesNavigation } from "@platform/blog";
adjacentPosts(posts, currentId);          // { newer, older } 公開日順の前後記事
seriesPosts(posts, "入門シリーズ");        // 連載を順番どおりに
seriesNavigation(posts, currentId);       // 連載内の { prev, next, index, total }
```

## パーマリンク(記事の URL 構造)
記事と URL パターンから記事 URL を組み立てます。手書きの `` `/blog/${slug}` `` を置き換え、URL 構造を一元管理できます。
```ts
import { buildPermalink, postUrl, matchPermalink, PERMALINK_PRESETS } from "@platform/blog";

// パターン + 記事 → パス。トークン: :slug :id :category :year :month :day
buildPermalink("/blog/:year/:month/:slug", post);            // "/blog/2025/07/hello-world"
buildPermalink(PERMALINK_PRESETS.dateAndName, post);          // "/2025/07/25/hello-world"
buildPermalink("/:category/:slug", post, { allowUnicode: true });  // "/技術/hello-world"

// 日付トークンは既定 UTC。日本時間で出すなら +540 分
buildPermalink("/:year/:month/:day/:slug", post, { utcOffsetMinutes: 540 });

// ベース URL を付けて絶対 URL に(canonical・OGP・RSS のリンクに使う)
postUrl(post, { baseUrl: "https://example.com", pattern: "/blog/:slug" });

// 逆引き: 受け取った URL からトークンを取り出す(ルーティング)
matchPermalink("/blog/:year/:month/:slug", "/blog/2025/07/hello");   // { year, month, slug }
```
プリセット: `postName`(/:slug)、`dateAndName`、`monthAndName`、`category`、`numeric`(/archives/:id)、`blog`。
生成した URL は `@platform/seo` の canonical/OGP、`buildRssFeed`/`buildSitemap` のリンクにそのまま渡せます。

