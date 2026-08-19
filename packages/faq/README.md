# @platform/faq

よくある質問（検索・役立ち度の記録）。**同じ質問に何度も答えない**ためのものです。

## これは何のためか

**同じ質問に何度も答えない**ためのものです。

「経費の締め日は」「有給の申請方法は」——
**書いておけば、聞かれる回数が減ります**。

## 使う前に知っておくこと

| | |
|---|---|
| **役立ち度を記録する** | **どれが役に立っているか**が分かります——**読まれていない項目は、書き方が悪いか、そもそも要らない**かです |
| **検索されやすい言葉で書く** | 利用者は「経費精算」ではなく「**交通費 いつまで**」と探します |
| **公開中のものだけを返します** | 下書きが混ざると、**答えていないことを答えたことになります** |
| **古い答えは害になります** | 制度が変わったのに残っていると、**間違った手続きをする人が出ます**——**見直す日を決めて**ください |

## よく使うもの

```ts
import { publishedOnly, searchFaq, byCategory } from "@platform/faq";
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
