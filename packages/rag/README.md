# @platform/rag

**RAG(検索拡張生成)の骨格**。役割は「検索」(操作は @platform/mcp)。以下を提供します:

- **チャンク分割**(`chunkDocument`): 段落境界を尊重し、長い段落は文字数で強制分割(overlap 対応)
- **権限継承検索**(`createRagStore` + `canAccess`): ドキュメントの ACL(roles / users / public)を検索時に強制。**ACL 未設定は既定で不可**、管理者ロールでも自動的に全件は見えない(壁打ちの要件「管理者権限で全検索しない」)
- **embedding 差し込み口**(`Embedder` / `VectorIndex`): 未接続なら BM25(@platform/search)のみで動作。接続すればベクトル+全文のハイブリッド(スコアの高い方を採用)
- **文脈整形**(`buildContext`): 検索結果を引用番号つきで LLM プロンプト用テキストに

```ts
import { createRagStore, buildContext } from "@platform/rag";
import { createSearch, createMemorySearch } from "@platform/search";

const rag = createRagStore({ backend: createSearch(createMemorySearch()) });
await rag.ingest([
  { id: "hr-1", title: "賞与規程", body: "...", acl: { roles: ["hr"] } },
  { id: "pub-1", title: "お知らせ", body: "...", acl: { public: true } },
]);

// 一般社員には public しか返らない(hr 文書は除外される)
const r = await rag.retrieve("賞与の支給日", { id: session.email, roles: session.roles });
if (r.ok) {
  const context = buildContext(r.value);      // → @platform/ai の messages に埋める
}
```

## ソース取り込みヘルパー

各ソースから抽出済みのテキスト/行を `RagDocument` に整える関数を提供します(抽出そのものは取り込み側の責務にし、rag は pdf/xlsx に依存しません):

- `textToDocument({ id, title, text, acl })`: プレーンテキスト → 1 ドキュメント
- `rowsToDocuments(rows, { idPrefix, title, mode })`: 表(Excel/CSV の行)→ ドキュメント群(`mode: "row"` で 1 行 1 doc、`"sheet"` でシート全体を 1 doc)
- `splitTextToDocuments(text, { idPrefix, title })`: 長文(PDF 抽出結果など)を空行区切りで節分割

```ts
import { readSheet } from "@platform/xlsx";
import { rowsToDocuments } from "@platform/rag";

const rows = await readSheet(buffer);           // 抽出は xlsx の責務
if (rows.ok) await rag.ingest(rowsToDocuments(rows.value, { idPrefix: "emp", title: "従業員", acl: { roles: ["hr"] } }));
```

## 検索対象(構想: PDF/Word/Excel/PowerPoint/設計書/API仕様書/Git/社内Wiki/Zoho Connect/DB)

このパッケージは「分割済みテキスト+ACL」を受け取る層です。各ソースからのテキスト抽出は取り込み側(アプリ/adapter)の責務で、`@platform/pdf`・`@platform/xlsx`・`@platform/importer` 等と組み合わせます。

## ベクトル検索(embedding)

埋め込みと索引の実装を同梱しています:

- **Embedder**: `@platform/ai` の `createOpenAiEmbedder`(実 API)/ `createHashEmbedder`(API 不要・開発用)
- **VectorIndex**: `createMemoryVectorIndex`(総当たりコサイン・開発用)/ `createPgVectorIndex(db)`(pgvector・本番用)

```ts
import { createRagStore, createMemoryVectorIndex } from "@platform/rag";
import { createHashEmbedder } from "@platform/ai";

const rag = createRagStore({
  backend: createSearch(createMemorySearch()),   // BM25
  embedder: createHashEmbedder(),                 // ベクトル
  vectorIndex: createMemoryVectorIndex(),
});
// retrieve は BM25 とベクトルの結果をマージし、権限フィルタ後に返す
```

pgvector を使う場合はテーブルを用意します(`CREATE EXTENSION vector; CREATE TABLE rag_vectors(id text PRIMARY KEY, chunk jsonb, embedding vector(N))`)。`createPgVectorIndex` に `@platform/db` の生 SQL 実行を注入してください。距離(`<=>`)は `score = 1 - distance` に変換されます。更新履歴・検索ログは取り込み側で `audit` と組み合わせます。
