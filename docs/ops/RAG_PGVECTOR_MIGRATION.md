# RAG を本番構成へ移行する（pgvector + OpenAI Embedder）

社内文書検索（RAG）は、開発・デモ時は**メモリ実装 + ハッシュ Embedder**で動きます。これは外部依存ゼロで手軽ですが、プロセスを再起動すると索引が消え、意味的な検索精度も限定的です。本番では **PostgreSQL の pgvector + OpenAI Embedder** に差し替えます。

コード側は差し替え可能な設計になっているため、`rag-service.ts` の配線を変えるだけで移行できます。文書取り込みや検索の呼び出し側（API・画面）は変更不要です。

## 現状（開発・デモ構成）

`apps/internal-app/src/server/rag-service.ts` は次のように組まれています。

- ベクトル索引: `createMemoryVectorIndex()`（プロセス内メモリ）
- Embedder: `createHashEmbedder(96)`（決定的だが意味を捉えない簡易版）
- 全文検索: `createSearch(createMemorySearch())`（BM25・メモリ）

この構成は「権限継承検索の挙動」を確認するには十分ですが、再起動で索引が消えます。

## 移行の全体像

1. PostgreSQL に pgvector 拡張とテーブルを用意する
2. OpenAI（または互換 API）の Embedder に切り替える
3. `rag-service.ts` のベクトル索引を `createPgVectorIndex(db)` に差し替える
4. 既存文書を再取り込み（re-ingest）して索引を作り直す

## 1. データベースの準備

pgvector 拡張を有効化し、埋め込み次元に合わせたテーブルを作ります。次元数は Embedder のモデルに合わせます（例: OpenAI `text-embedding-3-small` は 1536 次元）。

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE rag_vectors (
  id        text PRIMARY KEY,
  chunk     jsonb NOT NULL,
  embedding vector(1536)
);

-- 近傍検索を速くする索引（コサイン距離）。データ投入後に作成するのが定石。
CREATE INDEX ON rag_vectors USING hnsw (embedding vector_cosine_ops);
```

ConoHa / AWS などマネージド PostgreSQL では、pgvector が使えるプラン・バージョンかを事前に確認してください。

## 2. Embedder の切り替え

ハッシュ Embedder を OpenAI Embedder に差し替えます。API キーは環境変数から読みます。

```ts
import { createOpenAiEmbedder } from "@platform/ai";

const embedder = createOpenAiEmbedder({
  apiKey: env.OPENAI_API_KEY,
  model: "text-embedding-3-small", // 1536 次元。テーブルの vector(N) と必ず一致させる
});
```

**注意**: 埋め込みモデルを変えると次元数が変わります。テーブルの `vector(N)` と Embedder のモデルは常に一致させ、変更時は索引を作り直してください。

## 3. ベクトル索引を pgvector へ

`@platform/rag` の `createPgVectorIndex` は、`@platform/db` の生 SQL を注入して使います。`PgVectorDb` ポート（`execute` / `queryRows`）を db から組み立てます。

```ts
import { createPgVectorIndex } from "@platform/rag";
import { db } from "./services.js";

// @platform/db の rawExecute / rawQuery を PgVectorDb ポートに合わせる
const pgVectorDb = {
  async execute(sql: string, params: unknown[]) {
    await db.$executeRawUnsafe(sql, ...params);
  },
  async queryRows(sql: string, params: unknown[]) {
    return db.$queryRawUnsafe(sql, ...params) as Promise<{ id: string; chunk: string; distance: number }[]>;
  },
};

export const ragStore = createRagStore({
  backend: createSearch(createMemorySearch()), // 全文検索は用途次第で meilisearch 等に
  embedder,
  vectorIndex: createPgVectorIndex(pgVectorDb, "rag_vectors"),
  chunk: { maxChars: 600, overlap: 80 },
});
```

`createPgVectorIndex` は SQL 文字列の組み立てだけを行い、実行は注入された db に委ねます。距離（`<=>`）は小さいほど近いので、内部で `score = 1 - distance` に変換して返します。

## 4. 既存文書の再取り込み

索引の実体が変わるため、既存の文書をもう一度 `ragStore.ingest()` に通して埋め込みを作り直します。文書の原本（タイトル・本文・ACL）は別途保持しておき、そこから re-ingest するのが安全です。デモ用の `ensureSeeded()` と同じ流れです。

## 全文検索（BM25）について

ベクトル検索とは別に、キーワード一致の全文検索も併用できます（ハイブリッド検索）。メモリ実装 `createMemorySearch()` は小規模なら十分ですが、大規模では Meilisearch アダプタ（`@platform/search` の adapters/meilisearch）に差し替えられます。ベクトルと全文の切り替えは独立しているため、片方だけ本番化することも可能です。

## 権限継承は変わらない

`ragStore.retrieve(query, principal, n)` は、検索結果を principal（ユーザーの id とロール）で絞り込みます。この権限フィルタは索引の実装に依存しないため、pgvector に移行しても**権限のない文書が返らない**挙動は保たれます。

## チェックリスト

- [ ] pgvector 拡張が有効・テーブルの次元が Embedder と一致
- [ ] `OPENAI_API_KEY` を環境変数に設定
- [ ] `rag-service.ts` の `vectorIndex` を `createPgVectorIndex` に差し替え
- [ ] 既存文書を re-ingest して索引を再構築
- [ ] 検索が権限継承込みで期待どおり動くことを確認
