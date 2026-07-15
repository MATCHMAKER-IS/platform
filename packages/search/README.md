# @platform/search

全文検索の共通部品(Adapter パターン)。

- `createMeilisearchAdapter(config)` … 本番用(日本語トークナイズが標準で良好)
- `createMemorySearch()` … テスト・小規模向け(部分一致の簡易検索)

```ts
import { createSearch, createMemorySearch } from "@platform/search";
const search = createSearch(createMemorySearch());
await search.index([{ id: "1", title: "請求書の書き方", body: "..." }]);
const res = await search.search("請求書");
```

Meilisearch は Docker で手軽に立てられ、ConoHa / AWS どちらでも運用できます。
