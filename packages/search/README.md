# @platform/search

全文検索。**形態素解析器なしで日本語を実用的な精度**にします（BM25 + bigram）。

## これは何のためか

**形態素解析器を入れずに、日本語の検索を実用的な精度にする**ためのものです。

社内文書・マスタの横断検索に使います。
**少量ならこれで足ります**——索引を作らず、その場で検索できます。

## 使う前に知っておくこと

| | |
|---|---|
| **「京都」で「東京都」が出ます** | 2 文字ずつに切るためです（bigram）。**誤りではなく、この方式の性質**——利用者に聞かれたらそう説明してください |
| **検索のたびに全件を読みます** | 増えたら **DB の全文検索**（`@platform/db` の `fullTextSearch`）へ移してください |
| **空文字・記号でも落ちません** | 0 件を返します——**検索窓には何が入ってくるか分かりません** |
| **長い文書でも落ちません** | `push(...)` のスプレッドを使うと、**数万語で「引数が多すぎる」**とスタックが溢れます（2026-08 に実際に落ちました）——ループにしてあります |
| **賢くしようとしないこと** | 辞書を持たせると、**辞書の更新という新しい仕事**が増えます |

## よく使うもの

```ts
import { createSearch, tokenize } from "@platform/search";
import { createSearch, createMemorySearch } from "@platform/search";
const search = createSearch(createMemorySearch());
await search.index([{ id: "1", title: "請求書の書き方", body: "..." }]);
const res = await search.search("請求書");
```

Meilisearch は Docker で手軽に立てられ、ConoHa / AWS どちらでも運用できます。
