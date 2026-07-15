# @platform/faq — 社内 FAQ

質問と回答・カテゴリ・検索・「役に立った」投票の純ロジック。

記事の管理（`@platform/cms`）とは別物です。FAQ は「**困っている人が答えを探す**」ためのもので、**検索されやすさ**と**どれが役に立っているか**が要になります。

## 主な API

| 関数 | 用途 |
|---|---|
| `searchFaq(items, query)` | 検索。質問文 > キーワード > 回答本文 の順で加点 |
| `byCategory(items)` | カテゴリ別（件数の多い順） |
| `sortByHelpfulness(items)` | 役に立った順 |
| `helpfulRate(item)` | 役に立った率（票が無ければ `undefined`） |
| `needsReview(items)` | **見直しが必要な FAQ** を挙げる |
| `vote(item, helpful)` | 投票（公開中のみ） |
| `summarizeFaq(items)` | 管理画面用の集計 |

## 設計の判断

| 判断 | 理由 |
|---|---|
| **質問文の一致を最優先** | 「質問がそのまま一致する」のが最も確度が高い。回答本文の一致は弱い証拠 |
| **票が少ない 100% より、票の多い 90% を上に** | 1 票で 100% のものを上位に出すと、実態と合わない（票数で自信を割り引く） |
| **票が無ければ率は `undefined`** | 0% と区別する。「悪い」のではなく「まだ分からない」 |
| **要見直しを機械的に挙げる** | **役に立っていない FAQ は、無いより悪い**（探した人の時間を奪う）。定期的に見つけて直す |
| **票が少ないものは決めつけない** | 既定は 5 票以上で判定。1〜2 票で「悪い FAQ」と断じない |

## 使い方

```ts
import { searchFaq, needsReview, summarizeFaq } from "@platform/faq";

// 検索
for (const hit of searchFaq(items, "経費 締め切り")) {
  console.log(hit.item.question, `（${hit.matched}で一致）`);
}

// 管理画面: 直すべき FAQ
for (const { item, reason } of needsReview(items)) {
  console.log(item.question, "→", reason);
}
```

全文検索が必要なら `@platform/search`（BM25）に索引を委譲してください。このパッケージは索引を持ちません。

DB も UI も知りません。アプリ側でストアと画面を用意して使ってください。
