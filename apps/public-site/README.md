# public-site

公開サイト基盤アプリ。`@platform/site`（ページ・メニュー・お知らせ・ブロック）、`@platform/seo`（メタ・OGP・JSON-LD・robots）、`@platform/html`（本文の安全な HTML 化）、`@platform/analytics`（計測ビーコン）を組み合わせる。

- コンテンツは `src/server/site-content.ts`（既定インメモリ。CMS/DB へ差し替え可能）。
- ページは `src/app/[slug]/page.tsx` がブロックから描画し、SEO メタ・パンくず・お知らせ・計測ビーコンを付与。
- `GET /robots.txt` は公開/非公開の可視性に応じて生成。
