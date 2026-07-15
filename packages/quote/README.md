# @platform/quote — 見積書

明細計算は `@platform/invoice` を再利用し、見積特有の**有効期限・状態・請求書変換**を提供します。

## 主な API
- `buildQuote(header, lines)` / `quoteTotals(lines)` — 見積の組み立てと合計(税計算は invoice に委譲)。
- `isExpired` / `daysUntilExpiry` — 有効期限の判定。
- `quoteStatus(quote, now?)` — 状態(draft/sent/accepted/rejected/expired。明示状態 > 期限切れ)。
- `convertToInvoice(quote, { number, issueDate, dueDate })` — **承認済み見積 → 請求書**(明細・宛先を引き継ぐ)。

```ts
import { buildQuote, quoteStatus, convertToInvoice } from "@platform/quote";
const quote = buildQuote({ number: "QUO-0001", issueDate: "2025-07-01", validUntil: "2025-07-31", billTo: "株式会社◯◯" }, lines);
if (quoteStatus(quote) === "accepted") {
  const invoice = convertToInvoice(quote, { number: "INV-202507-0001", issueDate: "2025-07-16", dueDate: "2025-08-31" });
}
```
見積 → 請求 → (入金消込)の商流が基盤だけで通ります。
