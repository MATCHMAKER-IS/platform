# @platform/sequence

採番（請求書番号・伝票番号）。**連番と年度リセット**に対応します。

## これは何のためか

**番号の重複と飛びを防ぐ**ためのものです。

請求書番号が重複すると、**どちらの請求書か分かりません**——
経理では**致命的**です。

## 使う前に知っておくこと

| | |
|---|---|
| **年またぎに注意** | 12 月 31 日に採番して、**JST では 1 月 1 日**——**1 年ずれた番号**が出ます。`@platform/datetime` の JST 変換を通してください |
| **年度も JST 基準** | 4 月 1 日の 0 時〜9 時は、**UTC では前年度**です |
| **飛びは避けられません** | 採番してから保存に失敗すると、**その番号は欠けます**——**欠番があってよい**設計にしてください |
| **同時採番は DB で** | メモリで数えると、**2 台構成で同じ番号**が出ます |

## よく使うもの

```ts
import { periodToken, createSequencer, createMemorySequenceStore } from "@platform/sequence";
import { createSequencer, createMemorySequenceStore } from "@platform/sequence";

const invoiceNo = createSequencer(store, "invoice", {
  prefix: "INV-", padding: 6, resetPeriod: "fiscalYearly", // 年度(4月始まり)でリセット
});

await invoiceNo.next(); // "INV-FY2025-000001"
await invoiceNo.next(); // "INV-FY2025-000002"
```

`resetPeriod` は never/yearly/fiscalYearly/monthly。重複しない発番はストアの原子性で担保します
(本番は DB の行ロックや Redis INCR を注入)。
