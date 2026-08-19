# @platform/quote

見積書（明細・値引きの配分・有効期限）。

## これは何のためか

**見積は「後で請求書になる」もの**です。

見積と請求で額が違うと、**説明が要ります**——
**同じ計算を使う**ことで、それを防ぎます。

## 使う前に知っておくこと

| | |
|---|---|
| **全体値引きは明細に配分します** | 「合計から 1 万円引き」を**明細の金額に比例して**割り振ります——**そうしないと、明細の合計と総額が合いません** |
| **端数は最後の明細に寄せます** | 配分で必ず端数が出ます。**どこかに寄せないと 1 円合いません** |
| **値引きは総額を超えません** | マイナスの請求書は**出せません** |
| **有効期限を必ず入れる** | **半年前の見積で発注される**ことがあります——原価は変わっています |

## よく使うもの

```ts
import { applyDiscount, addRevision, diffRevisions } from "@platform/quote";
import { buildQuote, quoteStatus, convertToInvoice } from "@platform/quote";
const quote = buildQuote({ number: "QUO-0001", issueDate: "2025-07-01", validUntil: "2025-07-31", billTo: "株式会社◯◯" }, lines);
if (quoteStatus(quote) === "accepted") {
  const invoice = convertToInvoice(quote, { number: "INV-202507-0001", issueDate: "2025-07-16", dueDate: "2025-08-31" });
}
```
見積 → 請求 → (入金消込)の商流が基盤だけで通ります。
