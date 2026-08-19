# @platform/inventory

在庫と発注。**入出庫の履歴から残高を出します**（残高を直接持ちません）。

## これは何のためか

**残高を直接持つと、必ず合わなくなります。**
更新に失敗した、二重に引いた——**どこで狂ったか追えません**。

**入出庫の履歴だけを持ち、残高は計算する**——
これなら**いつでも作り直せます**。

## 使う前に知っておくこと

| | |
|---|---|
| **`applyMovement` は `ok` を必ず見る** | **`ok` を見ずに `movements` だけ使うと、出庫できていないのに成功したことになります** |
| **在庫がマイナスになることがあります** | **実務では普通に起きます**（棚卸で判明する）——**計算は止めません**。印が付くので**人が確かめて**ください |
| **在庫金額が 0 になることがあります** | 単価が入っていない品目です——**警告が付きます** |
| **一覧は SKU 順で** | 指定しないと、**行を更新するたびに並びが変わります** |

## よく使うもの

```ts
import { lotBalances, expiringSoon, expiredLots } from "@platform/inventory";
import { onHand, needsReorder, reorderQuantity, movingAverage } from "@platform/inventory";
const movements = [{ type: "inbound", quantity: 100, at: "2025-07-01", unitCost: 500 }, { type: "outbound", quantity: 30, at: "2025-07-05" }];
onHand(movements);                                   // 70
const policy = { safetyStock: 20, dailyDemand: 5, leadTimeDays: 7 };
if (needsReorder(onHand(movements), policy)) reorderQuantity(onHand(movements), policy);
movingAverage(movements);                            // { onHand, averageCost, value }
```
発注入荷 → 入庫記録 → 発注点で補充提案、という循環が基盤だけで通ります。
