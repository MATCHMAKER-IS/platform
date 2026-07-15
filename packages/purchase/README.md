# @platform/purchase — 発注(購買)

発注明細・金額(税計算は `@platform/invoice` 再利用)・入荷/発注残・状態を扱います。

## 主な API
- `buildPurchaseOrder(header, lines)` / `purchaseTotals(lines)` — 発注書の組み立てと金額。
- `receivingStatus(lines, receipts)` — 明細ごとの入荷数・**発注残(未入荷数量)**・完了判定。
- `totalOutstanding` — 発注残の合計。
- `purchaseStatus(order, receipts)` — draft/ordered/**partially_received**/received/cancelled。
- `overReceivedLines` — 過入荷(発注数量超過)の明細検出。

```ts
import { buildPurchaseOrder, purchaseStatus, receivingStatus } from "@platform/purchase";
const po = buildPurchaseOrder({ number: "PO-0001", orderDate: "2025-07-01", supplier: "仕入先", state: "ordered" }, lines);
const receipts = [{ lineIndex: 0, quantity: 80, receivedAt: "2025-07-10" }];
purchaseStatus(po, receipts);        // "partially_received"
receivingStatus(po.lines, receipts); // 明細ごとの発注残
```
発注 → 入荷(分納)→ 検収の残管理が基盤だけで通ります。
