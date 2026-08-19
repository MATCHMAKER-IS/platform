# @platform/purchase

発注と入荷（発注書・入荷確認・差異）。**「頼んだのに来ていない」を見つけます**。

## これは何のためか

**「頼んだのに来ていない」を見つける**ためのものです。

発注書を出しただけでは、**届いたかどうか誰も見ていません**——
**気づくのは、使おうとしたとき**です。

## 使う前に知っておくこと

| | |
|---|---|
| **未入荷を放置しない** | **納期を過ぎたものを一覧に出して**ください——**催促するきっかけ**が要ります |
| **発注より多く届くのは異常** | 誤出荷か、**発注を二重に出した**可能性があります——**黙って受け入れないで**ください |
| **税計算は `@platform/invoice` へ** | ここでは持ちません——**同じ計算を 2 か所に置くと、必ずずれます** |
| **分割納品を想定する** | 「100 個中 60 個入荷」は普通に起きます |

## よく使うもの

```ts
import { purchaseTotals, buildPurchaseOrder, receivingStatus } from "@platform/purchase";
import { buildPurchaseOrder, purchaseStatus, receivingStatus } from "@platform/purchase";
const po = buildPurchaseOrder({ number: "PO-0001", orderDate: "2025-07-01", supplier: "仕入先", state: "ordered" }, lines);
const receipts = [{ lineIndex: 0, quantity: 80, receivedAt: "2025-07-10" }];
purchaseStatus(po, receipts);        // "partially_received"
receivingStatus(po.lines, receipts); // 明細ごとの発注残
```
発注 → 入荷(分納)→ 検収の残管理が基盤だけで通ります。
