# @platform/inventory — 在庫管理

入出庫台帳・発注点・在庫評価(移動平均）。発注入荷（`@platform/purchase`）や売上出荷を入出庫として記録します。

## 主な API
- **入出庫台帳**: `onHand(movements)` / `summarize(movements)` / `applyMovement`（出庫超過を検証）。
  種別は inbound（入荷）/ outbound（出荷）/ adjustment（棚卸差異・符号付き）。
- **発注点**: `reorderPoint(policy)`（安全在庫 + リードタイム需要）/ `needsReorder` / `reorderQuantity`（目標在庫まで補充）。
- **在庫評価**: `movingAverage(movements)` → 現在庫・移動平均単価・在庫金額。

```ts
import { onHand, needsReorder, reorderQuantity, movingAverage } from "@platform/inventory";
const movements = [{ type: "inbound", quantity: 100, at: "2025-07-01", unitCost: 500 }, { type: "outbound", quantity: 30, at: "2025-07-05" }];
onHand(movements);                                   // 70
const policy = { safetyStock: 20, dailyDemand: 5, leadTimeDays: 7 };
if (needsReorder(onHand(movements), policy)) reorderQuantity(onHand(movements), policy);
movingAverage(movements);                            // { onHand, averageCost, value }
```
発注入荷 → 入庫記録 → 発注点で補充提案、という循環が基盤だけで通ります。
