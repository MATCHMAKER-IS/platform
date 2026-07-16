# workplace-ops — 情シスの「朝の 30 秒」

タスク・契約・FAQ を**横断して**「今日やるべきこと」を出すデモ。

## なぜこのデモがあるか

個々の基盤は「自分の領域」しか知りません。

| 基盤 | 分かること | 知らないこと |
|---|---|---|
| `@platform/task` | 期限切れのタスク | 契約のこと |
| `@platform/contract` | 解約予告の期限 | タスクのこと |
| `@platform/faq` | 直すべき FAQ | それが誰の仕事か |

**横断してひとつの「やることリスト」にするのはアプリの仕事**です（基盤の役割ではない）。このデモは、その組み立て方を示します。

## 並び順の考え方

**放っておくと損をするもの**が先です。

1. **契約の解約予告期限** — 過ぎると 1 年延びる（お金が出ていく）
2. **期限切れのタスク** — 約束を破っている
3. **役に立っていない FAQ** — 探した人の時間を奪う

## 使い方

```ts
import { buildTodoList, morningSummary, groupByOwner, formatTodoList } from "@demos/workplace-ops";

const todos = buildTodoList({ tasks, contracts, faqs });
console.log(formatTodoList(todos));
```

出力例:

```
🔴 清掃委託: 終了まであと 3 日(2026-07-18)
   → 更新するなら手続きしてください。放置すると切れます(総務)
🔴 サーバ更新: 期限(2026-07-10)を過ぎています
   → 田中 さんに状況を確認してください(田中)
🟡 資料整理: 期限(2026-07-12)を過ぎています
   → 担当者を決めてください
```

## 実装のポイント

| 判断 | 理由 |
|---|---|
| **判定は基盤に委ねる** | `contractAlerts` / `isOverdue` / `needsReview` をそのまま使う。同じ判定を再実装しない |
| **集計も基盤に委ねる** | `summarize` / `summarizeContracts` / `summarizeFaq` を束ねるだけ |
| **未割り当ても見せる**（`groupByOwner`） | 担当者が決まっていないものは放置されがち。目立たせる |
| **何をすべきか（action）を必ず添える** | 「期限切れです」だけでは動けない |

## API

| 関数 | 用途 |
|---|---|
| `buildTodoList(input)` | 3 領域から集めて深刻な順に |
| `morningSummary(input)` | 朝に見る 1 画面分の要約 |
| `groupByOwner(todos)` | 担当者ごと（朝会用） |
| `formatTodoList(todos)` | Slack 通知・メモ用のテキスト |

---

**関連**: [@platform/task](../../packages/task/README.md) / [@platform/contract](../../packages/contract/README.md) / [@platform/faq](../../packages/faq/README.md)
