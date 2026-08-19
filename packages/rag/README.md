# @platform/rag

社内文書の検索（RAG）。**AI に「うちの規程では」と答えさせる**ためのものです。

## これは何のためか

**AI は社内のことを知りません。**
就業規則も、経費の上限も、取引先の名前も。

**引いた文書を渡して答えさせる**——これが RAG です。
**目的は「嘘をつかせない」こと**です。

## 使う前に知っておくこと

| | |
|---|---|
| **入れてはいけない文書があります** | 給与表・人事評価が索引に入ると、**誰かの質問で引かれます**。**入れる前に弾いて**ください（`checkAiExclusion`）——**入れてから消しても、その間に引かれた分は戻せません** |
| **権限は必ず絞る** | **管理者でも全件は返しません**。「見られる文書だけ」を検索します |
| **引用元を必ず示す** | 「どの規程の何条か」が分からないと、**利用者は答えを信じられません** |
| **書いていないことを答えます** | `findUnsupportedClaims`（`@platform/ai`）で**数字と固有名詞を照合**してください |
| **文脈はトークン数で区切る** | 文字数で区切ると、**日本語では 5 倍以上ずれます** |

## よく使うもの

```ts
import { createRagStore, buildContextByTokens, selectDiverse } from "@platform/rag";
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
